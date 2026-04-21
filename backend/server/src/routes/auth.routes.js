const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const User = require("../models/User");
const { requireAuth } = require("../middlewares/auth");
const { env } = require("../config/env");

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
    const teacherExists = await User.findOne({ role: "teacher" }).lean();
    if (teacherExists) {
      return res.status(409).json({ message: "Teacher account already exists" });
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

module.exports = router;
