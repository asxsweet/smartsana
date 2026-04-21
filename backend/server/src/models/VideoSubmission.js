const mongoose = require("mongoose");

const answerSchema = new mongoose.Schema(
  {
    taskId: { type: mongoose.Schema.Types.ObjectId, required: true },
    answerText: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, default: "application/octet-stream" },
    size: { type: Number, default: 0 },
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const videoSubmissionSchema = new mongoose.Schema(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Video", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    answers: [answerSchema],
    files: [fileSchema],
    status: { type: String, enum: ["submitted", "graded"], default: "submitted" },
    score: { type: Number, default: 0 },
    feedback: { type: String, default: "" },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    gradedAt: { type: Date },
  },
  { timestamps: true }
);

videoSubmissionSchema.index({ videoId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model("VideoSubmission", videoSubmissionSchema);
