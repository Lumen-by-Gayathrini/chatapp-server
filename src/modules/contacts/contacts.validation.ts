import { z } from "zod";
import { objectId } from "../../lib/validators";

export const addContactSchema = {
  body: z
    .object({
      username: z.string().trim().min(1).optional(),
      userId: objectId.optional(),
    })
    .refine((b) => Boolean(b.username) || Boolean(b.userId), {
      message: "Provide a username or userId",
    }),
};

export const updateContactSchema = {
  body: z.object({
    alias: z.string().trim().max(60).nullable().optional(),
  }),
};

export type AddContactInput = z.infer<typeof addContactSchema.body>;
export type UpdateContactInput = z.infer<typeof updateContactSchema.body>;
