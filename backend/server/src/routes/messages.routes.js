const express = require("express");
const { z } = require("zod");
const Conversation = require("../models/Conversation");
const ChatMessage = require("../models/ChatMessage");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

const createConversationSchema = z.object({
  subject: z.string().min(2),
  text: z.string().min(2),
});

const sendMessageSchema = z.object({
  text: z.string().min(1),
});

router.get("/conversations", requireAuth, async (req, res) => {
  const filter = req.user.role === "teacher" ? {} : { studentId: req.user._id };
  const conversations = await Conversation.find(filter).sort({ lastMessageAt: -1 }).lean();
  return res.json({ conversations });
});

router.post("/conversations", requireAuth, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students can start a conversation" });
  }
  const parsed = createConversationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }

  const conversation = await Conversation.create({
    studentId: req.user._id,
    studentName: req.user.name,
    className: req.user.className || "",
    subject: parsed.data.subject,
    lastMessageAt: new Date(),
    lastMessagePreview: parsed.data.text.slice(0, 140),
    unreadForTeacher: 1,
    unreadForStudent: 0,
    lastSeenByStudentAt: new Date(),
  });

  await ChatMessage.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    senderRole: "student",
    text: parsed.data.text,
  });

  return res.status(201).json({ conversation });
});

router.get("/conversations/:id/messages", requireAuth, async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  if (req.user.role !== "teacher" && String(conversation.studentId) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  if (req.user.role === "teacher") {
    conversation.unreadForTeacher = 0;
    conversation.lastSeenByTeacherAt = new Date();
  } else {
    conversation.unreadForStudent = 0;
    conversation.lastSeenByStudentAt = new Date();
  }
  await conversation.save();
  const messages = await ChatMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 }).lean();
  return res.json({ conversation: conversation.toObject(), messages });
});

router.post("/conversations/:id/messages", requireAuth, async (req, res) => {
  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }

  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) return res.status(404).json({ message: "Conversation not found" });
  if (req.user.role !== "teacher" && String(conversation.studentId) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const message = await ChatMessage.create({
    conversationId: conversation._id,
    senderId: req.user._id,
    senderRole: req.user.role,
    text: parsed.data.text,
  });

  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = parsed.data.text.slice(0, 140);
  if (req.user.role === "teacher") {
    conversation.unreadForStudent = (conversation.unreadForStudent || 0) + 1;
    conversation.unreadForTeacher = 0;
    conversation.lastSeenByTeacherAt = new Date();
  } else {
    conversation.unreadForTeacher = (conversation.unreadForTeacher || 0) + 1;
    conversation.unreadForStudent = 0;
    conversation.lastSeenByStudentAt = new Date();
  }
  await conversation.save();

  return res.status(201).json({ message });
});

module.exports = router;
