import pino from "pino";
import pinoHttp from "pino-http";
import type { Request } from "express";
import { env, isTest } from "../config/env";

/**
 * Structured logger (TDD §9.3). No PII/secrets/tokens are logged. A pretty transport
 * is used in development for readability; production emits JSON; tests stay silent.
 */
export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
});

/** Per-request HTTP logger; reuses the request-id assigned upstream. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request & { id?: string }).id ?? "",
  autoLogging: !isTest,
});
