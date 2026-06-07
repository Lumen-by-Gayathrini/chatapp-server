import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors";
import { isTest } from "../config/env";

/**
 * Minimal fixed-window in-memory rate limiter (TDD §9.3).
 *
 * **Serverless caveat:** an in-memory counter is per warm instance and does not span
 * instances — fine for a single-instance lab study; production should back this with a
 * shared store (Upstash Redis, Plan §9 risk #5).
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip ?? "unknown");

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, options.max - bucket.count));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return next(AppError.rateLimited("Too many requests — please try again shortly"));
    }

    // Opportunistically prune expired buckets to bound memory on a warm instance.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    next();
  };
}

/**
 * Rate limiter for auth endpoints (login/register/refresh). Disabled under test so the
 * many auth calls across the suite don't trip the window.
 */
export function authRateLimit() {
  if (isTest) return (_req: Request, _res: Response, next: NextFunction) => next();
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    keyGenerator: (req) => `${req.ip}:auth`,
  });
}
