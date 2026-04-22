const request = require("supertest");
const app = require("../../backend/server/src/app");

describe("Backend app integration", () => {
  test("GET /api/health should return ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  test("GET unknown /api route should return 404 json", async () => {
    const res = await request(app).get("/api/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body.message).toContain("API route not found");
  });

  test("GET /api/users without auth should return 401", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});
