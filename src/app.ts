import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { env } from "./config/env";
import { connectDb } from "./lib/db";
import { httpLogger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { securityHeaders } from "./middleware/securityHeaders";
import { adminAuthRouter, authRouter } from "./modules/auth/auth.routes";
import { adminRouter } from "./modules/admin/admin.routes";
import { profileRouter } from "./modules/profile/profile.routes";
import { contactsRouter } from "./modules/contacts/contacts.routes";
import { conversationsRouter } from "./modules/conversations/conversations.routes";
import { mediaRouter } from "./modules/media/media.routes";
import { syncRouter } from "./modules/sync/sync.routes";

/**
 * Express application factory (TDD §4.2). Registers global middleware, mounts the
 * `/api/v1` routers, then the 404 + centralized error handler. Used by both the
 * local dev entry (`server.ts`) and the Vercel serverless entry (`api/index.ts`).
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(securityHeaders);
  app.use(
    cors({
      origin: env.CORS_PORTAL_ORIGIN,
      credentials: true,
    }),
  );

  // Per-request id (honours an inbound x-request-id when present). Runs before the
  // HTTP logger so each log line carries the id.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header("x-request-id");
    const requestId = incoming && incoming.length > 0 ? incoming : randomUUID();
    (req as Request & { id: string }).id = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.use(httpLogger);
  app.use(express.json({ limit: "1mb" }));

  const api = express.Router();

  // Liveness probe — must succeed WITHOUT a database connection (TDD §4.2 / Phase 0).
  api.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok", time: new Date().toISOString() });
  });

  // Ensure a live (cached) DB connection for every route registered after this point.
  api.use(async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      await connectDb();
      next();
    } catch (err) {
      next(err);
    }
  });

  // Feature routers.
  api.use("/auth", authRouter);
  api.use("/admin/auth", adminAuthRouter);
  api.use("/me", profileRouter);
  api.use("/contacts", contactsRouter);
  api.use("/conversations", conversationsRouter);
  api.use("/media", mediaRouter);
  api.use("/sync", syncRouter);
  // Admin/Portal API (admin auth). `/admin/auth` is registered above, before this
  // catch-all `/admin` mount, so admin login stays public.
  api.use("/admin", adminRouter);

  app.use("/api/v1", api);

  // 404 + centralized error handling.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
