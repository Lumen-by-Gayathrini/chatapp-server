import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createApp } from "../../src/app";
import { rateLimit } from "../../src/middleware/rateLimit";
import { errorHandler } from "../../src/middleware/error";
import { bearer, registerAndAuth } from "../helpers/users";

const app = createApp();

describe("rate limiting", () => {
  it("returns 429 RATE_LIMITED once the window max is exceeded", async () => {
    const limited = express();
    limited.get("/ping", rateLimit({ windowMs: 60_000, max: 2 }), (_req, res) => res.json({ ok: true }));
    limited.use(errorHandler);

    expect((await request(limited).get("/ping")).status).toBe(200);
    expect((await request(limited).get("/ping")).status).toBe(200);
    const third = await request(limited).get("/ping");
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe("RATE_LIMITED");
    expect(third.headers["retry-after"]).toBeTruthy();
  });

  it("exposes rate-limit headers", async () => {
    const limited = express();
    limited.get("/ping", rateLimit({ windowMs: 60_000, max: 5 }), (_req, res) => res.json({ ok: true }));
    const res = await request(limited).get("/ping");
    expect(res.headers["x-ratelimit-limit"]).toBe("5");
    expect(res.headers["x-ratelimit-remaining"]).toBe("4");
  });
});

describe("security headers", () => {
  it("sets baseline security headers on responses", async () => {
    const res = await request(app).get("/api/v1/healthz");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["referrer-policy"]).toBe("no-referrer");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("media size constraint", () => {
  it("rejects an oversized upload with 413", async () => {
    const mary = await registerAndAuth(app, "mary", "Mary");
    const tooBig = Buffer.alloc(5 * 1024 * 1024 + 1, 0xff); // > 5 MB default limit
    const res = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", tooBig, { filename: "big.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("log/secret hygiene", () => {
  it("never returns passwordHash in auth responses", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ username: "hygiene", password: "secret1", displayName: "H" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body.user)).not.toContain("passwordHash");
  });
});
