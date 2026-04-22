const mongoose = require("mongoose");
const app = require("./app");
const { env, validateEnv } = require("./config/env");
const { logger } = require("./logger");

async function start() {
  validateEnv();
  await mongoose.connect(env.mongodbUri);
  app.listen(env.port, () => {
    logger.info(`Server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  logger.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
