import { z } from "zod";

export const syncSchema = {
  query: z.object({ since: z.string().datetime().optional() }),
};

export type SyncQuery = z.infer<typeof syncSchema.query>;
