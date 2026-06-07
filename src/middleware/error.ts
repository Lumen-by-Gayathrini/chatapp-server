import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import mongoose from "mongoose";
import { AppError, toErrorEnvelope } from "../lib/errors";
import { logger } from "../lib/logger";

/** 404 handler — mounted after all routers. */
export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json(toErrorEnvelope(AppError.notFound(`Route not found: ${req.method} ${req.path}`)));
}

/**
 * Centralized error handler (TDD §5.1, §9.2). Maps known error types to the standard
 * envelope; anything unexpected becomes `500 INTERNAL` with no stack/PII leaked.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req as Request & { id?: string }).id;

  // 1. Our typed errors → straight to the envelope.
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err, requestId }, "AppError (server)");
    }
    return res.status(err.httpStatus).json(toErrorEnvelope(err));
  }

  // 2. zod errors that escaped the validate middleware.
  if (err instanceof ZodError) {
    const fields = err.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message }));
    return res
      .status(400)
      .json(toErrorEnvelope(AppError.validation("Request validation failed", { fields })));
  }

  // 3. Malformed JSON body (express.json throws a SyntaxError with a `status`).
  if (err instanceof SyntaxError && (err as any).status === 400 && "body" in (err as any)) {
    return res
      .status(400)
      .json(toErrorEnvelope(AppError.validation("Malformed JSON request body")));
  }

  // 4. Payload too large (express.json / multer).
  if ((err as any)?.type === "entity.too.large" || (err as any)?.status === 413) {
    return res
      .status(413)
      .json(toErrorEnvelope(AppError.payloadTooLarge("Request payload too large")));
  }

  // 5. Mongo duplicate-key → CONFLICT (services should pre-empt this, but be safe).
  if ((err as any)?.code === 11000) {
    return res.status(409).json(toErrorEnvelope(AppError.conflict("Resource already exists")));
  }

  // 6. Mongoose validation/cast errors → 400.
  if (err instanceof mongoose.Error.ValidationError || err instanceof mongoose.Error.CastError) {
    return res
      .status(400)
      .json(toErrorEnvelope(AppError.validation("Invalid request data")));
  }

  // 7. Anything else → opaque 500 (never leak internals).
  logger.error({ err, requestId }, "Unhandled error");
  return res.status(500).json(toErrorEnvelope(AppError.internal()));
}
