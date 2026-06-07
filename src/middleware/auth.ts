import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { verifyAccessToken } from "../lib/jwt";

function extractBearer(req: Request): string {
  const header = req.header("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw AppError.unauthenticated("Missing or malformed Authorization header");
  }
  return token;
}

/**
 * Participant authentication (TDD §8.1). Verifies the access token and attaches
 * `req.userId`. Rejects expired tokens with `TOKEN_EXPIRED` so the client can refresh.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const payload = verifyAccessToken(extractBearer(req));
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
