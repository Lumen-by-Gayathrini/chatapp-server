import { z } from "zod";

export const registerSchema = {
  body: z.object({
    username: z.string().trim().min(3).max(30),
    password: z.string().min(6).max(128),
    displayName: z.string().trim().min(1).max(60),
  }),
};

export const loginSchema = {
  body: z.object({
    username: z.string().trim().min(1),
    password: z.string().min(1),
  }),
};

export const refreshSchema = {
  body: z.object({ refreshToken: z.string().min(1) }),
};

export const logoutSchema = refreshSchema;

export const adminLoginSchema = {
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
  }),
};

export type RegisterInput = z.infer<typeof registerSchema.body>;
export type LoginInput = z.infer<typeof loginSchema.body>;
export type RefreshInput = z.infer<typeof refreshSchema.body>;
export type AdminLoginInput = z.infer<typeof adminLoginSchema.body>;
