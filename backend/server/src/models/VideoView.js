const mongoose = require("mongoose");

const videoViewSchema = new mongoose.Schema(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastViewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

videoViewSchema.index({ videoId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("VideoView", videoViewSchema);
