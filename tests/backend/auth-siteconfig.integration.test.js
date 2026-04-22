const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../../backend/server/src/app");
const { env } = require("../../backend/server/src/config/env");
const User = require("../../backend/server/src/models/User");
const SiteConfig = require("../../backend/server/src/models/SiteConfig");

describe("Auth + SiteConfig integration", () => {
  let mongoServer;
  let teacherToken;
  let studentToken;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      SiteConfig.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  async function createUsersAndTokens() {
    const passwordHash = await bcrypt.hash("demo123", 10);
    const teacher = await User.create({
      name: "Teacher",
      email: "teacher@test.kz",
      passwordHash,
      role: "teacher",
    });
    const student = await User.create({
      name: "Student",
      email: "student@test.kz",
      passwordHash,
      role: "student",
      className: "10A",
    });
    teacherToken = jwt.sign({ sub: String(teacher._id), role: "teacher" }, env.jwtSecret, { expiresIn: "1h" });
    studentToken = jwt.sign({ sub: String(student._id), role: "student" }, env.jwtSecret, { expiresIn: "1h" });
  }

  test("PATCH /api/auth/profile updates current user profile", async () => {
    await createUsersAndTokens();
    const res = await request(app)
      .patch("/api/auth/profile")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        bio: "Мен Arduino үйреніп жүрмін",
        phone: "+77001234567",
        location: "Алматы",
      });

    expect(res.status).toBe(200);
    expect(res.body.user.bio).toBe("Мен Arduino үйреніп жүрмін");
    expect(res.body.user.phone).toBe("+77001234567");
    expect(res.body.user.location).toBe("Алматы");
  });

  test("PUT /api/site-config blocks student by role", async () => {
    await createUsersAndTokens();
    const res = await request(app)
      .put("/api/site-config")
      .set("Authorization", `Bearer ${studentToken}`)
      .send({ sensors: [], codes: [], quickQuestions: [] });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Forbidden");
  });

  test("PUT /api/site-config rejects duplicated sensors", async () => {
    await createUsersAndTokens();
    const duplicatedConfig = {
      sensors: [
        { name: "DHT11", desc: "d", ico: "🌡️", image: "", lbl: "DHT11", note: "n", pins: [["PIN", "D2", "pd", "Сипат"]] },
        { name: "DHT11", desc: "d2", ico: "🌡️", image: "", lbl: "DHT11", note: "n2", pins: [["PIN", "D3", "pd", "Сипат"]] },
      ],
      codes: [],
      quickQuestions: [],
    };
    const res = await request(app)
      .put("/api/site-config")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(duplicatedConfig);

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("Дубликат датчик");
  });
});
