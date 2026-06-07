import mongoose from "mongoose";
import { env } from "../config/env";

/**
 * Cached Mongoose connection (TDD §4.3). Each warm serverless instance reuses a
 * single connection across invocations; opening one per request would exhaust the
 * Atlas connection limit. The connection (and the in-flight connect promise) are
 * cached on `globalThis` so they survive module-level hot reuse.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalForMongoose = globalThis as unknown as { __mongoose?: MongooseCache };

const cache: MongooseCache =
  globalForMongoose.__mongoose ?? (globalForMongoose.__mongoose = { conn: null, promise: null });

/**
 * Allow tests / callers to override the URI (e.g. mongodb-memory-server) without
 * mutating process.env globally.
 */
export async function connectDb(uri: string | undefined = env.MONGODB_URI): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!uri) {
    throw new Error("connectDb: no MongoDB URI provided (set MONGODB_URI)");
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      bufferCommands: false, // fail fast instead of buffering on a cold connection
      maxPoolSize: 5, // keep small per serverless instance
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** Tear down the connection and reset the cache (used by tests). */
export async function disconnectDb(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
  }
  cache.conn = null;
  cache.promise = null;
}
