import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "./logger";

/**
 * Media storage abstraction (TDD §13, Plan §8). The server codes to `StorageAdapter`;
 * a **local fake** is used for dev/tests (no external service) and a **Vercel Blob**
 * implementation for production, selected by env. This mirrors the app's
 * "fake-API-first" approach so the whole server builds and tests offline.
 */
export interface StoreInput {
  buffer: Buffer;
  contentType: string;
  filename?: string;
}

export interface StoredFile {
  url: string;
}

export interface StorageAdapter {
  save(input: StoreInput): Promise<StoredFile>;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Writes to the OS temp dir and returns a deterministic fake URL. Dev/tests only. */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly dir = join(tmpdir(), "chatapp-media");

  async save(input: StoreInput): Promise<StoredFile> {
    const key = `${randomUUID()}.${EXT_BY_TYPE[input.contentType] ?? "bin"}`;
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(join(this.dir, key), input.buffer);
    } catch (err) {
      // The bytes are not essential for the lab fake; the URL is what the client uses.
      logger.warn({ err }, "LocalStorageAdapter: failed to persist bytes (continuing)");
    }
    return { url: `https://media.local/${key}` };
  }
}

/** Uploads to Vercel Blob. Used when `BLOB_READ_WRITE_TOKEN` is configured. */
export class BlobStorageAdapter implements StorageAdapter {
  constructor(private readonly token: string) {}

  async save(input: StoreInput): Promise<StoredFile> {
    // Lazy import keeps the dependency out of the cold-start path when unused.
    const { put } = await import("@vercel/blob");
    const ext = EXT_BY_TYPE[input.contentType] ?? "bin";
    const result = await put(`media/${randomUUID()}.${ext}`, input.buffer, {
      access: "public",
      contentType: input.contentType,
      token: this.token,
    });
    return { url: result.url };
  }
}

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    adapter = env.BLOB_READ_WRITE_TOKEN
      ? new BlobStorageAdapter(env.BLOB_READ_WRITE_TOKEN)
      : new LocalStorageAdapter();
  }
  return adapter;
}
