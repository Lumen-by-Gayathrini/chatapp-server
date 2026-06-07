import { z } from "zod";

export const updateMeSchema = {
  body: z
    .object({
      displayName: z.string().trim().min(1).max(60).optional(),
      avatarUrl: z.string().trim().max(2048).nullable().optional(),
    })
    .refine((b) => b.displayName !== undefined || b.avatarUrl !== undefined, {
      message: "Provide at least one field to update",
    }),
};

export type UpdateMeInput = z.infer<typeof updateMeSchema.body>;
