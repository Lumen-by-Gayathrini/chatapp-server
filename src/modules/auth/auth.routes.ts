import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middleware/validate";
import { authRateLimit } from "../../middleware/rateLimit";
import * as authController from "./auth.controller";
import {
  adminLoginSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
} from "./auth.validation";

/** Participant auth routes — mounted at `/api/v1/auth`. */
export const authRouter = Router();

authRouter.use(authRateLimit());
authRouter.post("/register", validate(registerSchema), asyncHandler(authController.register));
authRouter.post("/login", validate(loginSchema), asyncHandler(authController.login));
authRouter.post("/refresh", validate(refreshSchema), asyncHandler(authController.refresh));
authRouter.post("/logout", validate(logoutSchema), asyncHandler(authController.logout));

/** Admin auth routes — mounted at `/api/v1/admin/auth`. */
export const adminAuthRouter = Router();

adminAuthRouter.use(authRateLimit());
adminAuthRouter.post(
  "/login",
  validate(adminLoginSchema),
  asyncHandler(authController.adminLogin),
);
