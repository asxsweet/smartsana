const express = require("express");
const { z } = require("zod");
const SiteConfig = require("../models/SiteConfig");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();

const DEFAULT_QUICK_QUESTIONS = [
  { label: "Arduino дегеніміз не?", prompt: "Arduino дегеніміз не және қайда қолданылады?", type: "quick" },
  { label: "Uno мен Nano айырмасы", prompt: "Arduino Uno мен Nano арасындағы айырмашылықтарды түсіндір", type: "quick" },
  { label: "Breadboard қалай жұмыс істейді?", prompt: "Breadboard қолдану ережелерін түсіндір", type: "quick" },
  { label: "LED + резистор таңдауы", prompt: "LED үшін резисторды қалай таңдаймын? Формуламен түсіндір", type: "quick" },
  { label: "DHT11 оқу логикасы", prompt: "DHT11 датчигінен мәлімет оқу қадамдарын түсіндір", type: "quick" },
  { label: "HC-SR04 формуласы", prompt: "HC-SR04 арқылы қашықтық есептеу формуласын түсіндір", type: "quick" },
  { label: "analogRead vs digitalRead", prompt: "analogRead және digitalRead айырмашылығы қандай?", type: "quick" },
  { label: "IoT жобаны неден бастау?", prompt: "Arduino IoT жобасын бастау үшін қадамдық жоспар бер", type: "quick" },
  { label: "was not declared", prompt: "was not declared in this scope қатесін қалай түзетемін?", type: "error" },
  { label: "expected ; before", prompt: "expected ';' before қатесінің негізгі себептері қандай?", type: "error" },
  { label: "No such file or directory", prompt: "No such file or directory қатесін Arduino IDE-де қалай шешемін?", type: "error" },
  { label: "avrdude sync error", prompt: "avrdude: stk500_recv() programmer is not responding қатесін шешу жолдары", type: "error" },
  { label: "COM порт көрінбейді", prompt: "Arduino COM порт неге көрінбейді және қалай түзетуге болады?", type: "error" },
  { label: "Upload failed", prompt: "Sketch upload failed қатесін жүйелі түрде диагностикалау қадамдары", type: "error" },
];

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
  const sensorKeySet = new Set();
  for (const s of normalized.sensors) {
    const key = `${(s.lbl || "").trim().toLowerCase()}::${(s.name || "").trim().toLowerCase()}`;
    if (sensorKeySet.has(key)) {
      return res.status(409).json({ message: "Дубликат датчик табылды" });
    }
    sensorKeySet.add(key);
  }
  const codeKeySet = new Set();
  for (const c of normalized.codes) {
    const key = `${(c.title || "").trim().toLowerCase()}::${(c.code || "").trim().toLowerCase()}`;
    if (codeKeySet.has(key)) {
      return res.status(409).json({ message: "Дубликат код табылды" });
    }
    codeKeySet.add(key);
  }
  const updated = await SiteConfig.findOneAndUpdate(
    {},
    normalized,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return res.json({ config: updated });
});

module.exports = router;
