const path = require("path");
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth.routes");
const videosRoutes = require("./routes/videos.routes");
const messagesRoutes = require("./routes/messages.routes");
const usersRoutes = require("./routes/users.routes");
const statsRoutes = require("./routes/stats.routes");
const aiRoutes = require("./routes/ai.routes");
const siteConfigRoutes = require("./routes/site-config.routes");
const { env } = require("./config/env");
const { logger } = require("./logger");

const app = express();

const allowedOrigins = env.clientOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "15mb" }));
app.use((req, _res, next) => {
  req.requestStartedAt = Date.now();
  next();
});
app.use((req, res, next) => {
  res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - (req.requestStartedAt || Date.now()),
    });
  });
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/videos", videosRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/site-config", siteConfigRoutes);

app.use("/api", (req, res) => {
  res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

const rootDir = path.resolve(__dirname, "..", "..", "..", "frontend");
app.use(express.static(rootDir));
app.use((_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.use((err, req, res, _next) => {
  const status = err?.status || 500;
  logger.error({
    message: err?.message || "Unhandled server error",
    status,
    method: req.method,
    url: req.originalUrl,
    durationMs: Date.now() - (req.requestStartedAt || Date.now()),
    stack: err?.stack,
  });
  if (res.headersSent) return;
  res.status(status).json({
    message: status >= 500 ? "Internal server error" : (err?.message || "Request failed"),
  });
});

module.exports = app;
