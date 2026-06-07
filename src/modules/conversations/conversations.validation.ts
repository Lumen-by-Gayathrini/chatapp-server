import { z } from "zod";
import { objectId } from "../../lib/validators";

export const createConversationSchema = {
  body: z.object({ peerUserId: objectId }),
};

export const readConversationSchema = {
  params: z.object({ id: objectId }),
  body: z.object({ upTo: z.string().datetime().optional() }),
};

export type CreateConversationInput = z.infer<typeof createConversationSchema.body>;
