const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { env, validateEnv } = require("../config/env");
const User = require("../models/User");
const Video = require("../models/Video");
const SiteConfig = require("../models/SiteConfig");
const { getSeedData } = require("./seed-data");

async function seed() {
  validateEnv();
  const profile = process.env.SEED_PROFILE || "dev";
  const data = getSeedData(profile);
  await mongoose.connect(env.mongodbUri);

  const teacherEmail = data.teacherEmail;
  let teacher = await User.findOne({ email: teacherEmail });
  if (!teacher) {
    const passwordHash = await bcrypt.hash("demo123", 10);
    teacher = await User.create({
      name: data.teacherName,
      email: teacherEmail,
      passwordHash,
      role: "teacher",
      className: "",
    });
  }

  for (const video of data.videos) {
    const exists = await Video.findOne({ num: video.num, title: video.title });
    if (!exists) {
      await Video.create({ ...video, createdBy: teacher._id });
    }
  }

  const cfg = await SiteConfig.findOne();
  if (!cfg) {
    await SiteConfig.create(data.config);
  }

  // eslint-disable-next-line no-console
  console.log("Seed completed");
  await mongoose.disconnect();
}

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Seed failed:", error.message);
  process.exit(1);
});
