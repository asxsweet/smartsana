const path = require("path");
const fs = require("fs");
const winston = require("winston");
const { env } = require("./config/env");

const logDir = path.resolve(__dirname, "..", "..", "..", "logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: env.logLevel || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, "error.log"), level: "error" }),
    new winston.transports.File({ filename: path.join(logDir, "combined.log") }),
  ],
});

if (env.nodeEnv !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

module.exports = { logger };
