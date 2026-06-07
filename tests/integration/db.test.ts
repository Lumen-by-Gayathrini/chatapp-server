import { describe, expect, it } from "vitest";
import mongoose from "mongoose";

/**
 * Proves the in-memory Mongo harness works: a trivial model round-trips through the
 * connection wired by `tests/setup.ts`. (Real domain models arrive in Phase 2.)
 */
const PingModel =
  mongoose.models.Ping ??
  mongoose.model("Ping", new mongoose.Schema({ label: { type: String, required: true } }));

describe("in-memory MongoDB harness", () => {
  it("persists and reads back a document", async () => {
    const created = await PingModel.create({ label: "hello" });
    const found = await PingModel.findById(created._id).lean();
    expect(found?.label).toBe("hello");
  });

  it("clears collections between tests (afterEach)", async () => {
    const count = await PingModel.countDocuments();
    expect(count).toBe(0);
  });
});
