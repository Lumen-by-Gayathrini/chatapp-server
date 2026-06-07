import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";

const app = createApp();

describe("health + error envelope", () => {
  it("GET /api/v1/healthz returns 200 without touching the DB", async () => {
    const res = await request(app).get("/api/v1/healthz");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("unknown route returns the standard 404 envelope", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(typeof res.body.error.message).toBe("string");
  });

  it("attaches an x-request-id response header", async () => {
    const res = await request(app).get("/api/v1/healthz");
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("echoes an inbound x-request-id", async () => {
    const res = await request(app).get("/api/v1/healthz").set("x-request-id", "abc-123");
    expect(res.headers["x-request-id"]).toBe("abc-123");
  });
});
