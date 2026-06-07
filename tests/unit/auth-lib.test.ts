import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import { env } from "../../src/config/env";
import { AppError } from "../../src/lib/errors";
import { signAccessToken, signAdminToken, verifyAccessToken, verifyAdminToken } from "../../src/lib/jwt";
import { comparePassword, hashPassword } from "../../src/lib/password";
import { generateRefreshToken, hashRefreshToken, refreshTokenExpiry } from "../../src/lib/refreshToken";
import { parseDurationMs } from "../../src/lib/duration";

describe("jwt", () => {
  it("signs and verifies a participant access token", () => {
    const token = signAccessToken("u1");
    expect(verifyAccessToken(token).sub).toBe("u1");
  });

  it("signs and verifies an admin token", () => {
    const token = signAdminToken("a1");
    expect(verifyAdminToken(token).sub).toBe("a1");
  });

  it("rejects a participant token on admin verification (typ separation)", () => {
    const token = signAccessToken("u1");
    expect(() => verifyAdminToken(token)).toThrow(AppError);
    try {
      verifyAdminToken(token);
    } catch (e) {
      expect((e as AppError).code).toBe("UNAUTHENTICATED");
    }
  });

  it("maps an expired token to TOKEN_EXPIRED", () => {
    const expired = jwt.sign({ typ: "access" }, env.JWT_ACCESS_SECRET, {
      subject: "u1",
      expiresIn: -10,
    });
    try {
      verifyAccessToken(expired);
      throw new Error("expected to throw");
    } catch (e) {
      expect((e as AppError).code).toBe("TOKEN_EXPIRED");
    }
  });
});

describe("password", () => {
  it("hashes and verifies", async () => {
    const hash = await hashPassword("s3cret");
    expect(hash).not.toBe("s3cret");
    expect(await comparePassword("s3cret", hash)).toBe(true);
    expect(await comparePassword("wrong", hash)).toBe(false);
  });
});

describe("refresh token + duration", () => {
  it("generates an opaque token and a deterministic hash", () => {
    const token = generateRefreshToken();
    expect(token).toMatch(/^rt_/);
    expect(hashRefreshToken(token)).toBe(hashRefreshToken(token));
    expect(hashRefreshToken(token)).not.toBe(token);
  });

  it("computes a future expiry", () => {
    expect(refreshTokenExpiry().getTime()).toBeGreaterThan(Date.now());
  });

  it("parses durations", () => {
    expect(parseDurationMs("15m")).toBe(900_000);
    expect(parseDurationMs("30d")).toBe(2_592_000_000);
    expect(parseDurationMs("500")).toBe(500);
  });
});
