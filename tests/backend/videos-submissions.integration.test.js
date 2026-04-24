const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const app = require("../../backend/server/src/app");
const { env } = require("../../backend/server/src/config/env");
const User = require("../../backend/server/src/models/User");
const Video = require("../../backend/server/src/models/Video");
const VideoSubmission = require("../../backend/server/src/models/VideoSubmission");
const VideoView = require("../../backend/server/src/models/VideoView");

describe("Videos + submissions integration", () => {
  let mongoServer;
  let teacherToken;
  let studentToken;
  let createdVideoId;
  let createdTaskId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Video.deleteMany({}),
      VideoSubmission.deleteMany({}),
      VideoView.deleteMany({}),
    ]);
    createdVideoId = null;
    createdTaskId = null;
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

  test("teacher creates video, student submits, teacher grades", async () => {
    await createUsersAndTokens();

    const createRes = await request(app)
      .post("/api/videos")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({
        num: 10,
        title: "Test video",
        desc: "desc",
        dur: "10:00",
        url: "",
        tasks: [{ title: "Task 1", instruction: "Do it", maxScore: 10 }],
      });
    expect(createRes.status).toBe(201);
    createdVideoId = String(createRes.body.video._id);
    createdTaskId = String(createRes.body.video.tasks[0]._id);

    const studentLessonRes = await request(app)
      .get(`/api/videos/${createdVideoId}/lesson`)
      .set("Authorization", `Bearer ${studentToken}`);
    expect(studentLessonRes.status).toBe(200);

    const submitRes = await request(app)
      .post(`/api/videos/${createdVideoId}/submissions`)
      .set("Authorization", `Bearer ${studentToken}`)
      .send({
        answers: [{ taskId: createdTaskId, answerText: "Done" }],
        files: [],
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.submission.aiScore).toBeDefined();
    expect(submitRes.body.submission.aiFeedback).toBeDefined();
    expect(submitRes.body.submission.aiSuggestion).toBeDefined();

    const gradeRes = await request(app)
      .patch(`/api/videos/${createdVideoId}/submissions/${submitRes.body.submission._id}/grade`)
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ score: 9, feedback: "Жақсы" });
    expect(gradeRes.status).toBe(200);
    expect(gradeRes.body.submission.status).toBe("graded");

    const overviewRes = await request(app)
      .get("/api/videos/submissions/overview")
      .set("Authorization", `Bearer ${teacherToken}`);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.summary.total).toBe(1);
    expect(overviewRes.body.summary.graded).toBe(1);
  });

  test("teacher cannot create duplicated video", async () => {
    await createUsersAndTokens();
    await request(app)
      .post("/api/videos")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ num: 11, title: "Dup video", desc: "", dur: "01:00", url: "", tasks: [] });

    const duplicateRes = await request(app)
      .post("/api/videos")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send({ num: 11, title: "Dup video", desc: "", dur: "01:00", url: "", tasks: [] });
    expect(duplicateRes.status).toBe(409);
    expect(duplicateRes.body.message).toContain("бұрын қосылған");
  });
});
