import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { validate } from "../../middleware/validate";
import * as messagesController from "./messages.controller";
import { listMessagesSchema, sendMessageSchema } from "./messages.validation";

/**
 * Message routes — nested under `/api/v1/conversations/:id/messages`. `mergeParams`
 * exposes the parent `:id`. Auth is inherited from the conversations router.
 */
export const messagesRouter = Router({ mergeParams: true });

messagesRouter.get("/", validate(listMessagesSchema), asyncHandler(messagesController.list));
messagesRouter.post("/", validate(sendMessageSchema), asyncHandler(messagesController.send));
