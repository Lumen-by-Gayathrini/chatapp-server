import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAdmin } from "../../middleware/adminAuth";
import { validate } from "../../middleware/validate";
import { idParam } from "../../lib/validators";
import * as usersService from "./admin.users.service";
import * as contactsService from "./admin.contacts.service";
import * as conversationsService from "./admin.conversations.service";
import * as tasksService from "./admin.tasks.service";
import {
  addUserContactSchema,
  adminMessagesQuerySchema,
  assignTaskSchema,
  createTaskSchema,
  createUserSchema,
  ensureConversationSchema,
  listAdminConversationsSchema,
  listTaskAttemptsSchema,
  resetPasswordSchema,
  simulateMessageSchema,
  updateTaskAttemptSchema,
  updateTaskSchema,
  updateUserSchema,
  userContactParamsSchema,
} from "./admin.validation";

/** Admin / Portal API — mounted at `/api/v1/admin`, all behind admin auth (TDD §6). */
export const adminRouter = Router();

adminRouter.use(requireAdmin);

// ─── Users ────────────────────────────────────────────────────────────────────
adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => res.status(200).json(await usersService.listUsers())),
);
adminRouter.post(
  "/users",
  validate(createUserSchema),
  asyncHandler(async (req, res) => res.status(201).json(await usersService.createUser(req.body))),
);
adminRouter.get(
  "/users/:id",
  validate({ params: idParam }),
  asyncHandler(async (req, res) => res.status(200).json(await usersService.getUser(req.params.id))),
);
adminRouter.patch(
  "/users/:id",
  validate(updateUserSchema),
  asyncHandler(async (req, res) =>
    res.status(200).json(await usersService.updateUser(req.params.id, req.body)),
  ),
);
adminRouter.post(
  "/users/:id/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await usersService.resetPassword(req.params.id, req.body.newPassword);
    res.status(204).end();
  }),
);

// ─── Contacts on behalf of users ─────────────────────────────────────────────────
adminRouter.get(
  "/users/:id/contacts",
  validate({ params: idParam }),
  asyncHandler(async (req, res) =>
    res.status(200).json(await contactsService.listUserContacts(req.params.id)),
  ),
);
adminRouter.post(
  "/users/:id/contacts",
  validate(addUserContactSchema),
  asyncHandler(async (req, res) =>
    res
      .status(201)
      .json(
        await contactsService.addUserContact(
          req.params.id,
          req.body.contactUserId,
          req.body.reciprocal,
        ),
      ),
  ),
);
adminRouter.delete(
  "/users/:id/contacts/:contactId",
  validate(userContactParamsSchema),
  asyncHandler(async (req, res) => {
    await contactsService.removeUserContact(req.params.id, req.params.contactId);
    res.status(204).end();
  }),
);

// ─── Conversations & chat simulation ─────────────────────────────────────────────
adminRouter.post(
  "/conversations",
  validate(ensureConversationSchema),
  asyncHandler(async (req, res) => {
    const result = await conversationsService.ensureConversation(req.body.participantIds);
    res.status(result.created ? 201 : 200).json(result.conversation);
  }),
);
adminRouter.get(
  "/conversations",
  validate(listAdminConversationsSchema),
  asyncHandler(async (req, res) =>
    res.status(200).json(await conversationsService.listUserConversations(req.query.userId as string)),
  ),
);
adminRouter.get(
  "/conversations/:id/messages",
  validate(adminMessagesQuerySchema),
  asyncHandler(async (req, res) =>
    res
      .status(200)
      .json(await conversationsService.getConversationMessages(req.params.id, req.query as never)),
  ),
);
adminRouter.post(
  "/conversations/:id/messages",
  validate(simulateMessageSchema),
  asyncHandler(async (req, res) => {
    const result = await conversationsService.simulateMessage(req.params.id, req.body);
    res.status(result.created ? 201 : 200).json(result.message);
  }),
);

// ─── Tasks & task-attempts ───────────────────────────────────────────────────────
adminRouter.post(
  "/tasks",
  validate(createTaskSchema),
  asyncHandler(async (req, res) => res.status(201).json(await tasksService.createTask(req.body))),
);
adminRouter.get(
  "/tasks",
  asyncHandler(async (_req, res) => res.status(200).json(await tasksService.listTasks())),
);
adminRouter.patch(
  "/tasks/:id",
  validate(updateTaskSchema),
  asyncHandler(async (req, res) =>
    res.status(200).json(await tasksService.updateTask(req.params.id, req.body)),
  ),
);
adminRouter.post(
  "/tasks/:id/assign",
  validate(assignTaskSchema),
  asyncHandler(async (req, res) =>
    res.status(201).json(await tasksService.assignTask(req.params.id, req.body.participantId)),
  ),
);
adminRouter.get(
  "/task-attempts",
  validate(listTaskAttemptsSchema),
  asyncHandler(async (req, res) =>
    res.status(200).json(await tasksService.listTaskAttempts(req.query as never)),
  ),
);
adminRouter.patch(
  "/task-attempts/:id",
  validate(updateTaskAttemptSchema),
  asyncHandler(async (req, res) =>
    res.status(200).json(await tasksService.updateTaskAttempt(req.params.id, req.body)),
  ),
);
