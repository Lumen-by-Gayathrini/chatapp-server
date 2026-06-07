import { z } from "zod";
import { objectId } from "../../lib/validators";

export const listMessagesSchema = {
  params: z.object({ id: objectId }),
  query: z.object({
    since: z.string().datetime().optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
};

export const sendMessageSchema = {
  params: z.object({ id: objectId }),
  body: z.object({
    clientId: z.string().min(1).max(128),
    type: z.enum(["TEXT", "IMAGE"]),
    text: z.string().max(4000).optional(),
    mediaId: objectId.optional(),
  }),
};

export type ListMessagesQuery = z.infer<typeof listMessagesSchema.query>;
export type SendMessageInput = z.infer<typeof sendMessageSchema.body>;
