import type { NextFunction, Request, Response } from "express";
import { isProduction } from "../config/env";

/**
 * Baseline security response headers (TDD §10 — security by default). Dependency-free
 * (no helmet) to keep the serverless cold-start lean. HSTS is only emitted in production,
 * where the API is served over HTTPS.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
}
