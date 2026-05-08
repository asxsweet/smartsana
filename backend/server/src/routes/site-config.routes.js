const express = require("express");
const { z } = require("zod");
const SiteConfig = require("../models/SiteConfig");
const { requireAuth, requireRole } = require("../middlewares/auth");
const DEFAULT_QUICK_QUESTIONS = require("../constants/default-quick-questions");

const router = express.Router();

const configSchema = z.object({
  sensors: z.array(z.object({
    _id: z.string().optional(),
    name: z.string(),
    desc: z.string(),
    ico: z.string(),
    image: z.string().optional(),
    lbl: z.string(),
    note: z.string(),
    pins: z.array(z.array(z.string())),
  })),
  codes: z.array(z.object({
    _id: z.string().optional(),
    title: z.string(),
    meta: z.string(),
    code: z.string(),
  })),
  quickQuestions: z.array(z.object({
    _id: z.string().optional(),
    label: z.string(),
    prompt: z.string(),
    type: z.enum(["quick", "error"]),
    answer: z.string().optional().default(""),
  })),
});

router.get("/", requireAuth, async (_req, res) => {
  let config = await SiteConfig.findOne();
  if (!config) {
    config = await SiteConfig.create({ sensors: [], codes: [], quickQuestions: DEFAULT_QUICK_QUESTIONS });
  } else if (!config.quickQuestions || config.quickQuestions.length < 6) {
    config.quickQuestions = DEFAULT_QUICK_QUESTIONS;
    await config.save();
  }
  return res.json({ config: config.toObject() });
});

router.put("/", requireAuth, requireRole("teacher"), async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const normalized = parsed.data;
  const existingSensorKeys = new Set();
  const newSensorKeys = new Set();
  for (const s of normalized.sensors) {
    const key = `${(s.lbl || "").trim().toLowerCase()}::${(s.name || "").trim().toLowerCase()}`;
    if (!key || key === "::") continue;
    if (s._id) {
      existingSensorKeys.add(key);
      continue;
    }
    if (newSensorKeys.has(key) || existingSensorKeys.has(key)) {
      return res.status(409).json({ message: "Дубликат датчик табылды" });
    }
    newSensorKeys.add(key);
  }

  const existingCodeKeys = new Set();
  const newCodeKeys = new Set();
  for (const c of normalized.codes) {
    const key = `${(c.title || "").trim().toLowerCase()}::${(c.code || "").trim().toLowerCase()}`;
    if (!key || key === "::") continue;
    if (c._id) {
      existingCodeKeys.add(key);
      continue;
    }
    if (newCodeKeys.has(key) || existingCodeKeys.has(key)) {
      return res.status(409).json({ message: "Дубликат код табылды" });
    }
    newCodeKeys.add(key);
  }
  const updated = await SiteConfig.findOneAndUpdate(
    {},
    normalized,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.json({ config: updated });
});

module.exports = router;
