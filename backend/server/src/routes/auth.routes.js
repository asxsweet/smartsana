const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { requireAuth } = require("../middlewares/auth");
const { env } = require("../config/env");
const { logger } = require("../logger");

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  className: z.string().optional().default(""),
  role: z.enum(["student", "teacher"]).optional().default("student"),
  teacherSetupCode: z.string().optional().default(""),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  className: z.string().optional(),
  bio: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  location: z.string().max(120).optional(),
  avatarUrl: z.string().max(5 * 1024 * 1024).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: "7d" });
}

function toUserResponse(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    className: user.className || "",
    bio: user.bio || "",
    phone: user.phone || "",
    location: user.location || "",
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt,
  };
}

async function verifyPasswordAndMigrate(user, password) {
  if (typeof user.passwordHash !== "string" || !user.passwordHash) return false;
  if (user.passwordHash.startsWith("$2")) {
    return bcrypt.compare(password, user.passwordHash);
  }
  const ok = password === user.passwordHash;
  if (ok) {
    user.passwordHash = await bcrypt.hash(password, 10);
    await user.save();
  }
  return ok;
}

router.post("/register", async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
    }
    const { name, email, password, className, role, teacherSetupCode } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      // Recovery variant: if the same person re-registers with same name, refresh password and login.
      if ((exists.name || "").trim().toLowerCase() === name.trim().toLowerCase()) {
        exists.passwordHash = await bcrypt.hash(password, 10);
        if (role === "student" && className) {
          exists.className = className;
        }
        await exists.save();
        const token = signToken(exists);
        return res.status(200).json({ token, user: toUserResponse(exists), recovered: true });
      }
      return res.status(409).json({ message: "Email already registered. Use login or exact same name for recovery." });
    }

    let finalRole = "student";
    if (role === "teacher") {
      if (!env.teacherSetupCode) {
        return res.status(403).json({ message: "Teacher setup is disabled" });
      }
      if (teacherSetupCode !== env.teacherSetupCode) {
        return res.status(403).json({ message: "Teacher setup code is invalid" });
      }
      const teachersCount = await User.countDocuments({ role: "teacher" });
      if (teachersCount >= env.teacherMaxAccounts) {
        return res.status(409).json({ message: `Teacher account limit reached (${env.teacherMaxAccounts})` });
      }
      finalRole = "teacher";
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      role: finalRole,
      className: finalRole === "teacher" ? "" : className,
    });
    const token = signToken(user);
    return res.status(201).json({ token, user: toUserResponse(user) });
  } catch (error) {
    if (error?.code === 11000 && error?.keyPattern?.email) {
      return res.status(409).json({ message: "Email already registered. Use login." });
    }
    logger.error({
      message: "Register failed",
      route: "POST /api/auth/register",
      error: error?.message || "Unknown error",
      stack: error?.stack,
    });
    return res.status(500).json({ message: "Тіркелу кезінде сервер қатесі болды. Кейінірек қайталап көріңіз." });
  }
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return res.status(401).json({ message: "Invalid email or password" });

  const ok = await verifyPasswordAndMigrate(user, password);
  if (!ok) return res.status(401).json({ message: "Invalid email or password" });

  const token = signToken(user);
  return res.json({ token, user: toUserResponse(user) });
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: toUserResponse(req.user) });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const updates = parsed.data;
  if (typeof updates.name === "string") req.user.name = updates.name.trim();
  if (typeof updates.bio === "string") req.user.bio = updates.bio.trim();
  if (typeof updates.phone === "string") req.user.phone = updates.phone.trim();
  if (typeof updates.location === "string") req.user.location = updates.location.trim();
  if (typeof updates.avatarUrl === "string") req.user.avatarUrl = updates.avatarUrl.trim();
  if (typeof updates.className === "string" && req.user.role === "student") {
    req.user.className = updates.className.trim();
  }
  await req.user.save();
  return res.json({ user: toUserResponse(req.user) });
});

router.patch("/password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid request", issues: parsed.error.flatten() });
  }
  const { currentPassword, newPassword } = parsed.data;
  const ok = await verifyPasswordAndMigrate(req.user, currentPassword);
  if (!ok) {
    return res.status(400).json({ message: "Ағымдағы құпиясөз қате" });
  }
  req.user.passwordHash = await bcrypt.hash(newPassword, 10);
  await req.user.save();
  return res.json({ ok: true });
});

module.exports = router;
