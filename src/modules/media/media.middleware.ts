import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(AppError.unsupportedMediaType("Only JPEG, PNG and WebP images are allowed"));
    }
  },
});

/**
 * Runs multer for a single `file` field and normalizes its failures to AppErrors:
 * oversized → 413, disallowed type → 415 (TDD §9.3, §16; media constraints ≤5 MB).
 */
export function uploadSingle(field: string) {
  const handler = upload.single(field);
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(AppError.payloadTooLarge("Image exceeds the maximum allowed size"));
      }
      next(err);
    });
  };
}
