import { afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDb } from "../src/lib/db";

/**
 * Global test harness (TDD §11). Boots a single in-memory MongoDB for the whole run
 * (stored on globalThis so it survives the per-file re-evaluation of this setup file)
 * and keeps it connected, clearing collections between tests. mongodb-memory-server
 * installs its own process-exit cleanup, so no explicit teardown is needed.
 * No Atlas / external services are required (Plan §8).
 */
const g = globalThis as unknown as { __mongoTest?: MongoMemoryServer };

beforeAll(async () => {
  if (!g.__mongoTest) {
    g.__mongoTest = await MongoMemoryServer.create();
  }
  await connectDb(g.__mongoTest.getUri());
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1) return;
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});
