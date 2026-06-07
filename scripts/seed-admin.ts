import { connectDb, disconnectDb } from "../src/lib/db";
import { env } from "../src/config/env";
import { Admin, type IAdmin } from "../src/models/admin.model";
import { hashPassword } from "../src/lib/password";
import type { HydratedDocument } from "mongoose";

export interface SeedAdminInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SeedAdminResult {
  created: boolean;
  admin: HydratedDocument<IAdmin>;
}

/**
 * Idempotently ensure a researcher account exists (TDD §6.1 — admins are seeded
 * out-of-band, never self-registered). Importable so it can be tested against the
 * in-memory DB; runnable directly via `npm run seed:admin`.
 */
export async function seedAdmin(input: SeedAdminInput): Promise<SeedAdminResult> {
  const email = input.email.toLowerCase();
  const existing = await Admin.findOne({ email });
  if (existing) {
    return { created: false, admin: existing };
  }
  const admin = await Admin.create({
    email,
    passwordHash: await hashPassword(input.password),
    displayName: input.displayName,
  });
  return { created: true, admin };
}

async function main() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required to seed an admin");
  }
  await connectDb(env.MONGODB_URI);
  const result = await seedAdmin({
    email: process.env.SEED_ADMIN_EMAIL ?? "researcher@example.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!",
    displayName: process.env.SEED_ADMIN_NAME ?? "Researcher",
  });
  // eslint-disable-next-line no-console
  console.log(
    `${result.created ? "Created" : "Already exists"} admin: ${result.admin.email}`,
  );
  await disconnectDb();
}

// Only auto-run when invoked directly (not when imported by tests).
if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
