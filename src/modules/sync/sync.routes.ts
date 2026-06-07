import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as syncController from "./sync.controller";
import { syncSchema } from "./sync.validation";

/** Polling sync — mounted at `/api/v1/sync`, behind participant auth. */
export const syncRouter = Router();

syncRouter.use(requireAuth);
syncRouter.get("/", validate(syncSchema), asyncHandler(syncController.sync));
