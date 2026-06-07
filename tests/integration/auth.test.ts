import { beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createApp } from "../../src/app";
import { requireAuth } from "../../src/middleware/auth";
import { requireAdmin } from "../../src/middleware/adminAuth";
import { errorHandler } from "../../src/middleware/error";
import { Admin, User } from "../../src/models";
import { signAccessToken } from "../../src/lib/jwt";
import { seedAdmin } from "../../scripts/seed-admin";

const app = createApp();

beforeAll(async () => {
  await Promise.all([User.init(), Admin.init()]);
});

/** Tiny app exercising the auth middlewares against real routes. */
function guardedApp() {
  const a = express();
  a.get("/participant", requireAuth, (req, res) => res.json({ userId: req.userId }));
  a.get("/admin-only", requireAdmin, (req, res) => res.json({ adminId: req.adminId }));
  a.use(errorHandler);
  return a;
}

async function registerUser(username = "mary") {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ username, password: "secret1", displayName: "Mary" });
  return res;
}

describe("POST /auth/register", () => {
  it("creates a user and returns tokens (no passwordHash leaked)", async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ username: "mary", displayName: "Mary", status: "ACTIVE" });
    expect(res.body.user.id).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toMatch(/^rt_/);
  });

  it("rejects a duplicate username with 409 CONFLICT", async () => {
    await registerUser();
    const res = await registerUser();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("rejects invalid input with the validation envelope", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({ username: "ab" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/login", () => {
  it("logs in with correct credentials", async () => {
    await registerUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "mary", password: "secret1" });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });

  it("rejects a wrong password with 401 INVALID_CREDENTIALS", async () => {
    await registerUser();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "mary", password: "nope" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects an unknown user with 401", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "ghost", password: "whatever" });
    expect(res.status).toBe(401);
  });
});

describe("POST /auth/refresh (rotation) + logout", () => {
  it("rotates tokens and rejects the old refresh token", async () => {
    const { body } = await registerUser();
    const first = body.refreshToken;

    const rotated = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: first });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(first);

    // The presented (old) token is now revoked.
    const reuse = await request(app).post("/api/v1/auth/refresh").send({ refreshToken: first });
    expect(reuse.status).toBe(401);

    // The new one still works.
    const again = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: rotated.body.refreshToken });
    expect(again.status).toBe(200);
  });

  it("logout revokes the refresh token (204, idempotent)", async () => {
    const { body } = await registerUser();
    const out = await request(app).post("/api/v1/auth/logout").send({ refreshToken: body.refreshToken });
    expect(out.status).toBe(204);

    const reuse = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: body.refreshToken });
    expect(reuse.status).toBe(401);
  });
});

describe("auth middleware enforcement", () => {
  const guarded = guardedApp();

  it("requireAuth rejects a missing token with 401", async () => {
    const res = await request(guarded).get("/participant");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("requireAuth accepts a valid participant token", async () => {
    const res = await request(guarded)
      .get("/participant")
      .set("authorization", `Bearer ${signAccessToken("u123")}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe("u123");
  });

  it("requireAdmin rejects a participant token (participant cannot reach /admin/*)", async () => {
    const res = await request(guarded)
      .get("/admin-only")
      .set("authorization", `Bearer ${signAccessToken("u123")}`);
    expect(res.status).toBe(401);
  });
});

describe("admin login + seeding", () => {
  it("seedAdmin is idempotent and the admin can log in", async () => {
    const first = await seedAdmin({
      email: "researcher@example.com",
      password: "AdminPass1",
      displayName: "Researcher",
    });
    expect(first.created).toBe(true);

    const second = await seedAdmin({
      email: "researcher@example.com",
      password: "AdminPass1",
      displayName: "Researcher",
    });
    expect(second.created).toBe(false);

    const res = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "researcher@example.com", password: "AdminPass1" });
    expect(res.status).toBe(200);
    expect(res.body.admin).toMatchObject({ email: "researcher@example.com", displayName: "Researcher" });
    expect(res.body.accessToken).toBeTruthy();

    // The admin token is accepted by requireAdmin.
    const guarded = guardedApp();
    const guardedRes = await request(guarded)
      .get("/admin-only")
      .set("authorization", `Bearer ${res.body.accessToken}`);
    expect(guardedRes.status).toBe(200);
    expect(guardedRes.body.adminId).toBe(first.admin._id.toString());
  });

  it("rejects admin login with a wrong password", async () => {
    await seedAdmin({ email: "researcher@example.com", password: "AdminPass1", displayName: "R" });
    const res = await request(app)
      .post("/api/v1/admin/auth/login")
      .send({ email: "researcher@example.com", password: "wrong" });
    expect(res.status).toBe(401);
  });
});
