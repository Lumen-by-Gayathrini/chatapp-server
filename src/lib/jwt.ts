import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errors";

/**
 * JWT access tokens (TDD §8). Participant tokens carry `typ: "access"`, admin tokens
 * `typ: "admin"`; both are signed with the access secret and distinguished by `typ`,
 * so a participant token can never satisfy admin verification and vice-versa.
 */
export type TokenType = "access" | "admin";

interface TokenPayload extends JwtPayload {
  sub: string;
  typ: TokenType;
}

function sign(sub: string, typ: TokenType): string {
  const opts: SignOptions = { expiresIn: env.ACCESS_TTL as SignOptions["expiresIn"] };
  return jwt.sign({ typ }, env.JWT_ACCESS_SECRET, { ...opts, subject: sub });
}

export function signAccessToken(userId: string): string {
  return sign(userId, "access");
}

export function signAdminToken(adminId: string): string {
  return sign(adminId, "admin");
}

function verify(token: string, expected: TokenType): TokenPayload {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw AppError.tokenExpired();
    }
    throw AppError.unauthenticated("Invalid access token");
  }
  if (typeof decoded === "string" || decoded.typ !== expected || !decoded.sub) {
    throw AppError.unauthenticated("Invalid access token");
  }
  return decoded as TokenPayload;
}

export function verifyAccessToken(token: string): TokenPayload {
  return verify(token, "access");
}

export function verifyAdminToken(token: string): TokenPayload {
  return verify(token, "admin");
}
