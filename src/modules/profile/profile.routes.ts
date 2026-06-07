import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as profileController from "./profile.controller";
import { updateMeSchema } from "./profile.validation";

/** Profile routes — mounted at `/api/v1/me`, all behind participant auth. */
export const profileRouter = Router();

profileRouter.use(requireAuth);
profileRouter.get("/", asyncHandler(profileController.getMe));
profileRouter.patch("/", validate(updateMeSchema), asyncHandler(profileController.updateMe));
