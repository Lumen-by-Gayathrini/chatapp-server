import { config as loadDotenv } from "dotenv";
import { z } from "zod";

// Load .env for local development. On Vercel, env vars are injected by the platform.
loadDotenv();

// Dev-only fallback secrets — the server refuses to start in production if these leak through.
const DEV_ACCESS_SECRET = "dev-access-secret-change-me";
const DEV_REFRESH_SECRET = "dev-refresh-secret-change-me";

/**
 * Environment schema — validated once at boot. Missing/invalid values fail fast
 * (TDD §4.5, §9.1). Secrets have dev fallbacks so the server and offline tests run
 * without a .env file; production must set real values.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  // Optional locally (memory-server supplies the URI in tests/dev); required in production.
  MONGODB_URI: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(1).default(DEV_ACCESS_SECRET),
  JWT_REFRESH_SECRET: z.string().min(1).default(DEV_REFRESH_SECRET),
  ACCESS_TTL: z.string().default("15m"),
  REFRESH_TTL: z.string().default("30d"),

  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),

  CORS_PORTAL_ORIGIN: z.string().default("http://localhost:3001"),

  UPSTASH_REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    throw new Error("Environment validation failed");
  }

  const env = parsed.data;

  // Treat a Vercel production deployment as production even if NODE_ENV isn't explicitly
  // "production" in the function runtime.
  const inProduction =
    env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  // Production-only safety checks (TDD §10, §16 — secrets management).
  if (inProduction) {
    if (!env.MONGODB_URI) {
      throw new Error("MONGODB_URI is required in production");
    }
    if (
      env.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET ||
      env.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET
    ) {
      throw new Error("Refusing to start in production with default JWT secrets — set strong values");
    }
  }

  return env;
}

export const env = loadEnv();

export const isProduction =
  env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
export const isTest = env.NODE_ENV === "test";
