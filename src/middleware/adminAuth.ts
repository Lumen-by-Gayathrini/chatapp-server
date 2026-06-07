import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { verifyAdminToken } from "../lib/jwt";

/**
 * Researcher/admin authentication (TDD §8.2). Verifies an **admin** token and attaches
 * `req.adminId`. A participant access token carries `typ: "access"` and therefore can
 * never satisfy admin verification — enforcing the strict participant/admin separation.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.header("authorization") ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw AppError.unauthenticated("Missing or malformed Authorization header");
    }
    const payload = verifyAdminToken(token);
    req.adminId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
