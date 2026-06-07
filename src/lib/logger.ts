import pino from "pino";
import pinoHttp from "pino-http";
import type { Request } from "express";
import { env, isTest } from "../config/env";

/**
 * Structured logger (TDD §9.3). No PII/secrets/tokens are logged. A pretty transport is
 * used for local readability, but NEVER on Vercel — pino worker-thread transports cannot
 * be resolved inside a bundled serverless function ("unable to determine transport
 * target"), so we emit plain JSON there. Tests stay silent.
 */
const usePrettyTransport = env.NODE_ENV === "development" && !process.env.VERCEL;

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
  ...(usePrettyTransport
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" },
        },
      }
    : {}),
});

/** Per-request HTTP logger; reuses the request-id assigned upstream. */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as Request & { id?: string }).id ?? "",
  autoLogging: !isTest,
});
