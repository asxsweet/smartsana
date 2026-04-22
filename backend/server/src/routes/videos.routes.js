const express = require("express");
const { z } = require("zod");
const Video = require("../models/Video");
const VideoSubmission = require("../models/VideoSubmission");
const VideoView = require("../models/VideoView");
const { requireAuth, requireRole } = require("../middlewares/auth");
const { isConfigured: isCloudinaryConfigured, uploadSubmissionFile } = require("../services/cloudinary");

const router = express.Router();

const createVideoSchema = z.object({
  num: z.coerce.number().int().positive(),
  title: z.string().min(1),
  desc: z.string().optional().default(""),
  dur: z.string().optional().default("0:00"),
  url: z.string().optional().default(""),
  tasks: z.array(z.object({
    title: z.string().min(1),
    instruction: z.string().min(1),
    maxScore: z.coerce.number().int().positive().default(10),
  })).optional().default([]),
});

const submitSchema = z.object({
  answers: z.array(z.object({
    taskId: z.string().min(1),
    answerText: z.string().optional().default(""),
  })).optional().default([]),
  files: z.array(z.object({
    name: z.string().min(1),
    type: z.string().optional().default("application/octet-stream"),
    size: z.coerce.number().min(0).max(8 * 1024 * 1024).optional().default(0),
    dataUrl: z.string().startsWith("data:").min(1),
  })).optional().default([]),
});

const gradeSchema = z.object({
  score: z.coerce.number().min(0),
  feedback: z.string().optional().default(""),
});

router.get("/", requireAuth, async (_req, res) => {
  const videos = await Video.find().sort({ num: 1, createdAt: 1 }).lean();
  return res.json({ videos });
});

router.post("/", requireAuth, requireRole("teacher"), async (req, res) => {
  const parsed = createVideoSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const duplicate = await Video.findOne({
    $or: [
      { num: parsed.data.num },
      ...(parsed.data.url ? [{ url: parsed.data.url }] : []),
      { title: parsed.data.title },
    ],
  }).lean();
  if (duplicate) {
    return res.status(409).json({ message: "Ұқсас видео бұрын қосылған" });
  }
  const video = await Video.create({ ...parsed.data, createdBy: req.user._id });
  return res.status(201).json({ video });
});

router.get("/progress/me", requireAuth, async (req, res) => {
  if (req.user.role !== "student") return res.json({ progress: [] });
  const progress = await VideoView.find({ studentId: req.user._id }).lean();
  const normalized = progress.map((p) => ({
    videoId: String(p.videoId),
    lastViewedAt: p.lastViewedAt || null,
  }));
  return res.json({ progress: normalized });
});

router.delete("/:id", requireAuth, requireRole("teacher"), async (req, res) => {
  const deleted = await Video.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "Video not found" });
  return res.json({ ok: true });
});

router.get("/:id/lesson", requireAuth, async (req, res) => {
  const video = await Video.findById(req.params.id).lean();
  if (!video) return res.status(404).json({ message: "Video not found" });

  if (req.user.role === "teacher") {
    const submissions = await VideoSubmission.find({ videoId: video._id })
      .populate("studentId", "name email className")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ video, submissions });
  }

  const submission = await VideoSubmission.findOne({ videoId: video._id, studentId: req.user._id }).lean();
  const view = await VideoView.findOneAndUpdate(
    { videoId: video._id, studentId: req.user._id },
    { $set: { lastViewedAt: new Date() } },
    { upsert: true, new: true }
  ).lean();
  return res.json({ video, submission, lastViewedAt: view?.lastViewedAt || null });
});

router.post("/:id/viewed", requireAuth, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "Only students can track progress" });
  const video = await Video.findById(req.params.id).lean();
  if (!video) return res.status(404).json({ message: "Video not found" });
  const viewed = await VideoView.findOneAndUpdate(
    { videoId: req.params.id, studentId: req.user._id },
    { $set: { lastViewedAt: new Date() } },
    { upsert: true, new: true }
  );
  return res.json({ viewed });
});

router.post("/:id/submissions", requireAuth, async (req, res) => {
  if (req.user.role !== "student") return res.status(403).json({ message: "Only students can submit" });
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const video = await Video.findById(req.params.id).lean();
  if (!video) return res.status(404).json({ message: "Video not found" });

  const validTaskIds = new Set((video.tasks || []).map((t) => String(t._id)));
  const invalid = parsed.data.answers.some((a) => !validTaskIds.has(a.taskId));
  if (invalid) return res.status(400).json({ message: "Invalid task reference" });
  const hasTextAnswer = parsed.data.answers.some((a) => (a.answerText || "").trim().length > 0);
  const hasFiles = (parsed.data.files || []).length > 0;
  const totalFileSize = (parsed.data.files || []).reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalFileSize > 20 * 1024 * 1024) {
    return res.status(400).json({ message: "Файлдардың жалпы көлемі 20MB-тан аспауы керек" });
  }
  if (!hasTextAnswer && !hasFiles) {
    return res.status(400).json({ message: "Кемінде мәтін жауабы немесе файл болуы керек" });
  }
  if (hasFiles && !isCloudinaryConfigured) {
    return res.status(500).json({ message: "Файл жүктеу сервисі бапталмаған (Cloudinary env қажет)" });
  }

  const uploadedFiles = [];
  for (const file of parsed.data.files) {
    const upload = await uploadSubmissionFile(file.dataUrl, file.name);
    uploadedFiles.push({
      name: file.name,
      type: file.type || upload.type,
      size: file.size || upload.size,
      url: upload.url,
      publicId: upload.publicId,
    });
  }

  const submission = await VideoSubmission.findOneAndUpdate(
    { videoId: video._id, studentId: req.user._id },
    {
      $set: {
        answers: parsed.data.answers.map((a) => ({ taskId: a.taskId, answerText: (a.answerText || "").trim() })),
        files: uploadedFiles,
        status: "submitted",
        feedback: "",
        score: 0,
        gradedBy: null,
        gradedAt: null,
      },
    },
    { upsert: true, new: true }
  );
  return res.status(201).json({ submission });
});

router.patch("/:id/submissions/:submissionId/grade", requireAuth, requireRole("teacher"), async (req, res) => {
  const parsed = gradeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const submission = await VideoSubmission.findOneAndUpdate(
    { _id: req.params.submissionId, videoId: req.params.id },
    {
      $set: {
        status: "graded",
        score: parsed.data.score,
        feedback: parsed.data.feedback,
        gradedBy: req.user._id,
        gradedAt: new Date(),
      },
    },
    { new: true }
  );
  if (!submission) return res.status(404).json({ message: "Submission not found" });
  return res.json({ submission });
});

router.get("/submissions/overview", requireAuth, requireRole("teacher"), async (_req, res) => {
  const submissions = await VideoSubmission.find()
    .populate("videoId", "title num")
    .populate("studentId", "name email className")
    .sort({ createdAt: -1 })
    .lean();

  const summary = {
    total: submissions.length,
    submitted: submissions.filter((s) => s.status === "submitted").length,
    graded: submissions.filter((s) => s.status === "graded").length,
  };

  return res.json({ summary, submissions });
});

module.exports = router;
