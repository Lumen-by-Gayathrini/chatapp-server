import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { idParam } from "../../lib/validators";
import { messagesRouter } from "../messages/messages.routes";
import * as conversationsController from "./conversations.controller";
import { createConversationSchema, readConversationSchema } from "./conversations.validation";

/** Conversation routes — mounted at `/api/v1/conversations`, all behind participant auth. */
export const conversationsRouter = Router();

conversationsRouter.use(requireAuth);

conversationsRouter.get("/", asyncHandler(conversationsController.list));
conversationsRouter.post(
  "/",
  validate(createConversationSchema),
  asyncHandler(conversationsController.create),
);
conversationsRouter.delete(
  "/:id",
  validate({ params: idParam }),
  asyncHandler(conversationsController.remove),
);
conversationsRouter.post(
  "/:id/read",
  validate(readConversationSchema),
  asyncHandler(conversationsController.read),
);

// Nested message routes inherit auth from above.
conversationsRouter.use("/:id/messages", messagesRouter);
