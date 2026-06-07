import bcrypt from "bcryptjs";

/**
 * Password hashing (TDD §8.1). `bcryptjs` is pure-JS — no native build on serverless
 * (Plan §9 risk #2). Cost factor ≥ 10.
 */
const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
