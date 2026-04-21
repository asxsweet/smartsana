const mongoose = require("mongoose");

const sensorSchema = new mongoose.Schema(
  {
    name: String,
    desc: String,
    ico: String,
    image: String,
    lbl: String,
    note: String,
    pins: [[String]],
  },
  { _id: true }
);

const codeSchema = new mongoose.Schema(
  {
    title: String,
    meta: String,
    code: String,
  },
  { _id: true }
);

const quickQuestionSchema = new mongoose.Schema(
  {
    label: String,
    prompt: String,
    type: { type: String, enum: ["quick", "error"], default: "quick" },
  },
  { _id: true }
);

const siteConfigSchema = new mongoose.Schema(
  {
    sensors: [sensorSchema],
    codes: [codeSchema],
    quickQuestions: [quickQuestionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SiteConfig", siteConfigSchema);
