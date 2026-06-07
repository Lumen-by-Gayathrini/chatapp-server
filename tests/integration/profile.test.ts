import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth } from "../helpers/users";

const app = createApp();

describe("GET /me", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/me");
    expect(res.status).toBe(401);
  });

  it("returns the authenticated user", async () => {
    const mary = await registerAndAuth(app, "mary", "Mary");
    const res = await request(app).get("/api/v1/me").set(bearer(mary.token));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: mary.user.id, username: "mary", displayName: "Mary" });
    expect(res.body.passwordHash).toBeUndefined();
  });
});

describe("PATCH /me", () => {
  it("updates the display name", async () => {
    const mary = await registerAndAuth(app, "mary", "Mary");
    const res = await request(app)
      .patch("/api/v1/me")
      .set(bearer(mary.token))
      .send({ displayName: "Mary P." });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Mary P.");

    const after = await request(app).get("/api/v1/me").set(bearer(mary.token));
    expect(after.body.displayName).toBe("Mary P.");
  });

  it("sets and clears the avatar url", async () => {
    const mary = await registerAndAuth(app, "mary", "Mary");
    const set = await request(app)
      .patch("/api/v1/me")
      .set(bearer(mary.token))
      .send({ avatarUrl: "https://cdn.example.com/a.png" });
    expect(set.body.avatarUrl).toBe("https://cdn.example.com/a.png");

    const cleared = await request(app)
      .patch("/api/v1/me")
      .set(bearer(mary.token))
      .send({ avatarUrl: null });
    expect(cleared.body.avatarUrl).toBeNull();
  });

  it("rejects an empty update with VALIDATION_ERROR", async () => {
    const mary = await registerAndAuth(app, "mary", "Mary");
    const res = await request(app).patch("/api/v1/me").set(bearer(mary.token)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
