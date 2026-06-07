import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { AppError } from "../lib/errors";

/**
 * zod request-validation middleware (TDD §9.2). Validates any of `body`, `params`,
 * `query` and replaces each with the parsed (typed, coerced) value. On failure it
 * throws a `VALIDATION_ERROR` whose `details` list the offending fields.
 */
export interface ValidationSchemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

interface FieldIssue {
  path: string;
  message: string;
}

function toFieldIssues(err: ZodError, source: string): FieldIssue[] {
  return err.issues.map((i) => ({
    path: [source, ...i.path.map(String)].filter(Boolean).join("."),
    message: i.message,
  }));
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const issues: FieldIssue[] = [];

    for (const source of ["body", "params", "query"] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const result = schema.safeParse(req[source]);
      if (result.success) {
        // params/query are read-only getters on some Express versions; assign safely.
        try {
          (req as any)[source] = result.data;
        } catch {
          /* leave original if not assignable */
        }
      } else {
        issues.push(...toFieldIssues(result.error, source));
      }
    }

    if (issues.length > 0) {
      return next(AppError.validation("Request validation failed", { fields: issues }));
    }
    next();
  };
}
