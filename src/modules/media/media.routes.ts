import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import * as mediaController from "./media.controller";
import { uploadSingle } from "./media.middleware";

/** Media upload — mounted at `/api/v1/media`, behind participant auth. */
export const mediaRouter = Router();

mediaRouter.use(requireAuth);
mediaRouter.post("/", uploadSingle("file"), asyncHandler(mediaController.upload));
