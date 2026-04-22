const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    className: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    status: { type: String, enum: ["open", "closed"], default: "open" },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessagePreview: { type: String, default: "" },
    unreadForTeacher: { type: Number, default: 0 },
    unreadForStudent: { type: Number, default: 0 },
    lastSeenByTeacherAt: { type: Date, default: null },
    lastSeenByStudentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
