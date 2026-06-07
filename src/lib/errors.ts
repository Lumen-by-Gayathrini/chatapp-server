/**
 * Typed application errors (TDD §5.1, §9.2). Services throw `AppError`; a single
 * error-handling middleware maps it to the standard error envelope:
 *
 *   { "error": { "code", "message", "details" } }
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_CONTACT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "INTERNAL";

/** Default HTTP status for each error code (§5.1 catalogue). */
export const ERROR_STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_CONTACT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown, httpStatus?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus ?? ERROR_STATUS[code];
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  // ─── Convenience factories ────────────────────────────────────────────────
  static validation(message = "Validation failed", details?: unknown) {
    return new AppError("VALIDATION_ERROR", message, details);
  }
  static invalidCredentials(message = "Invalid username or password") {
    return new AppError("INVALID_CREDENTIALS", message);
  }
  static unauthenticated(message = "Authentication required") {
    return new AppError("UNAUTHENTICATED", message);
  }
  static tokenExpired(message = "Access token expired") {
    return new AppError("TOKEN_EXPIRED", message);
  }
  static forbidden(message = "You do not have permission to perform this action") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(message = "Resource not found") {
    return new AppError("NOT_FOUND", message);
  }
  static conflict(message = "Conflict", details?: unknown) {
    return new AppError("CONFLICT", message, details);
  }
  static duplicateContact(message = "Contact already exists") {
    return new AppError("DUPLICATE_CONTACT", message);
  }
  static payloadTooLarge(message = "Payload too large") {
    return new AppError("PAYLOAD_TOO_LARGE", message);
  }
  static unsupportedMediaType(message = "Unsupported media type") {
    return new AppError("UNSUPPORTED_MEDIA_TYPE", message);
  }
  static rateLimited(message = "Too many requests") {
    return new AppError("RATE_LIMITED", message);
  }
  static internal(message = "Internal server error") {
    return new AppError("INTERNAL", message);
  }
}

/** Serialize an AppError to the standard wire envelope. */
export function toErrorEnvelope(err: AppError) {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  };
}
