const dotenv = require("dotenv");

dotenv.config();

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "",
  grokApiKey: process.env.GROK_API_KEY || "",
  grokModel: process.env.GROK_MODEL || "grok-2-latest",
  aiBaseUrl: process.env.AI_BASE_URL || "",
  clientOrigin: process.env.CLIENT_ORIGIN || "*",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || "",
  teacherSetupCode: process.env.TEACHER_SETUP_CODE || "",
  teacherMaxAccounts: Math.max(1, Number(process.env.TEACHER_MAX_ACCOUNTS || 6)),
  logLevel: process.env.LOG_LEVEL || "info",
};

function validateEnv() {
  const required = ["mongodbUri", "jwtSecret"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
  if (env.nodeEnv === "production") {
    if (!env.teacherSetupCode) {
      throw new Error("TEACHER_SETUP_CODE is required in production");
    }
    if (env.clientOrigin.includes("*")) {
      throw new Error("CLIENT_ORIGIN cannot include * in production");
    }
  }
}

module.exports = { env, validateEnv };
