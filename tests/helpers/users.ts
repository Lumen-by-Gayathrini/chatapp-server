import request from "supertest";
import type { Express } from "express";
import { seedAdmin } from "../../scripts/seed-admin";

export interface AuthedAdmin {
  token: string;
  admin: { id: string; email: string; displayName: string };
}

/** Seed (idempotently) and log in a researcher, returning an admin token. */
export async function authAdmin(
  app: Express,
  email = "researcher@example.com",
  password = "AdminPass1",
): Promise<AuthedAdmin> {
  await seedAdmin({ email, password, displayName: "Researcher" });
  const res = await request(app).post("/api/v1/admin/auth/login").send({ email, password });
  return { token: res.body.accessToken, admin: res.body.admin };
}

export interface AuthedUser {
  token: string;
  refreshToken: string;
  user: { id: string; username: string; displayName: string };
}

/** Register a participant through the real auth route and return their tokens + DTO. */
export async function registerAndAuth(
  app: Express,
  username: string,
  displayName = username,
): Promise<AuthedUser> {
  const res = await request(app)
    .post("/api/v1/auth/register")
    .send({ username, password: "secret1", displayName });
  return { token: res.body.accessToken, refreshToken: res.body.refreshToken, user: res.body.user };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
