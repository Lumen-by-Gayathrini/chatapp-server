import { z } from "zod";
import { objectId } from "../../lib/validators";

// ─── Users ────────────────────────────────────────────────────────────────────
export const createUserSchema = {
  body: z.object({
    username: z.string().trim().min(3).max(30),
    displayName: z.string().trim().min(1).max(60),
    password: z.string().min(6).max(128),
  }),
};

export const updateUserSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      displayName: z.string().trim().min(1).max(60).optional(),
      status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    })
    .refine((b) => b.displayName !== undefined || b.status !== undefined, {
      message: "Provide at least one field to update",
    }),
};

export const resetPasswordSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ newPassword: z.string().min(6).max(128) }),
};

// ─── Contacts on behalf of users ────────────────────────────────────────────────
export const addUserContactSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ contactUserId: objectId, reciprocal: z.boolean().optional() }),
};

export const userContactParamsSchema = {
  params: z.object({ id: objectId, contactId: objectId }),
};

// ─── Conversations & simulation ──────────────────────────────────────────────────
export const ensureConversationSchema = {
  body: z.object({ participantIds: z.tuple([objectId, objectId]) }),
};

export const listAdminConversationsSchema = {
  query: z.object({ userId: objectId }),
};

export const adminMessagesQuerySchema = {
  params: z.object({ id: objectId }),
  query: z.object({
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};

export const simulateMessageSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    asUserId: objectId,
    type: z.enum(["TEXT", "IMAGE"]),
    text: z.string().max(4000).optional(),
    mediaId: objectId.optional(),
    clientId: z.string().min(1).max(128).optional(),
  }),
};

// ─── Tasks & task-attempts ───────────────────────────────────────────────────────
export const createTaskSchema = {
  body: z.object({
    code: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(120),
    description: z.string().max(2000).optional(),
  }),
};

export const updateTaskSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      title: z.string().trim().min(1).max(120).optional(),
      description: z.string().max(2000).nullable().optional(),
    })
    .refine((b) => b.title !== undefined || b.description !== undefined, {
      message: "Provide at least one field to update",
    }),
};

export const assignTaskSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ participantId: objectId }),
};

export const listTaskAttemptsSchema = {
  query: z.object({ participantId: objectId.optional(), taskId: objectId.optional() }),
};

export const updateTaskAttemptSchema = {
  params: z.object({ id: objectId }),
  body: z
    .object({
      status: z.enum(["ASSIGNED", "STARTED", "COMPLETED", "FAILED"]).optional(),
      metrics: z
        .object({
          durationMs: z.number().int().min(0).nullable().optional(),
          errorCount: z.number().int().min(0).optional(),
          helpRequests: z.number().int().min(0).optional(),
        })
        .optional(),
      notes: z.string().max(2000).nullable().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: "Provide at least one field to update" }),
};
