const express = require("express");
const User = require("../models/User");
const Video = require("../models/Video");
const Message = require("../models/Message");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();

router.get("/overview", requireAuth, requireRole("teacher"), async (_req, res) => {
  const [studentsCount, videosCount, messagesCount, recentUsers] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Video.countDocuments(),
    Message.countDocuments(),
    User.find().sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  res.json({
    studentsCount,
    videosCount,
    messagesCount,
    recentUsers: recentUsers.map((u) => ({
      id: u._id,
      name: u.name,
      role: u.role,
      className: u.className || "",
      createdAt: u.createdAt,
    })),
  });
});

module.exports = router;
