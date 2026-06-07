import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";
import { parseDurationMs } from "./duration";

/**
 * Opaque refresh tokens (TDD §8.1). A high-entropy random string is returned to the
 * client; only its SHA-256 hash is stored. (sha256 is appropriate here — unlike a
 * password, the token already carries full entropy, so no slow KDF is needed.)
 */
export function generateRefreshToken(): string {
  return `rt_${randomBytes(32).toString("hex")}`;
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function refreshTokenExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + parseDurationMs(env.REFRESH_TTL));
}
