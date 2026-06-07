import { Types } from "mongoose";
import { z } from "zod";

/** Reusable zod schema for a MongoDB ObjectId string (→ 400 VALIDATION_ERROR if malformed). */
export const objectId = z
  .string()
  .refine((v) => Types.ObjectId.isValid(v), { message: "Invalid id" });

/** `{ id }` route-param schema for `/resource/:id`. */
export const idParam = z.object({ id: objectId });
