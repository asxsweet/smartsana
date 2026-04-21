const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    instruction: { type: String, required: true, trim: true },
    maxScore: { type: Number, default: 10 },
  },
  { _id: true }
);

const videoSchema = new mongoose.Schema(
  {
    num: { type: Number, required: true },
    title: { type: String, required: true, trim: true },
    desc: { type: String, default: "" },
    dur: { type: String, default: "0:00" },
    url: { type: String, default: "" },
    tasks: [taskSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Video", videoSchema);
