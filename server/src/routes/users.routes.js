const express = require("express");
const User = require("../models/User");
const Video = require("../models/Video");
const VideoSubmission = require("../models/VideoSubmission");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    className: user.className || "",
    createdAt: user.createdAt,
  };
}

router.get("/", requireAuth, requireRole("teacher"), async (_req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  return res.json({ users: users.map(sanitizeUser) });
});

router.delete("/:id", requireAuth, requireRole("teacher"), async (req, res) => {
  if (req.params.id === String(req.user._id)) {
    return res.status(400).json({ message: "Cannot delete yourself" });
  }
  const deleted = await User.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: "User not found" });
  return res.json({ ok: true });
});

router.get("/:id/progress", requireAuth, requireRole("teacher"), async (req, res) => {
  const student = await User.findById(req.params.id).lean();
  if (!student || student.role !== "student") {
    return res.status(404).json({ message: "Student not found" });
  }

  const [videos, submissions] = await Promise.all([
    Video.find().select("_id num title tasks").sort({ num: 1 }).lean(),
    VideoSubmission.find({ studentId: student._id }).lean(),
  ]);
  const byVideo = new Map(submissions.map((s) => [String(s.videoId), s]));

  const progress = videos.map((v) => {
    const sub = byVideo.get(String(v._id));
    const tasksCount = (v.tasks || []).length;
    const answered = sub ? (sub.answers || []).length : 0;
    return {
      videoId: v._id,
      num: v.num,
      title: v.title,
      tasksCount,
      answeredCount: answered,
      status: sub ? sub.status : "not_submitted",
      score: sub?.score || 0,
      feedback: sub?.feedback || "",
      updatedAt: sub?.updatedAt || null,
    };
  });

  const summary = {
    totalVideos: videos.length,
    submitted: progress.filter((p) => p.status === "submitted").length,
    graded: progress.filter((p) => p.status === "graded").length,
    notSubmitted: progress.filter((p) => p.status === "not_submitted").length,
  };

  return res.json({
    student: sanitizeUser(student),
    summary,
    progress,
  });
});

module.exports = router;
