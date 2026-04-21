const mongoose = require("mongoose");
const app = require("./app");
const { env, validateEnv } = require("./config/env");

async function start() {
  validateEnv();
  await mongoose.connect(env.mongodbUri);
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server running on http://localhost:${env.port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
