import { beforeAll, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import {
  Contact,
  Conversation,
  Message,
  RefreshToken,
  Task,
  User,
} from "../../src/models";

const oid = () => new mongoose.Types.ObjectId();

// Ensure indexes (incl. unique) are built before exercising constraints.
beforeAll(async () => {
  await Promise.all([
    User.init(),
    Contact.init(),
    Conversation.init(),
    Message.init(),
    RefreshToken.init(),
    Task.init(),
  ]);
});

describe("User model", () => {
  it("enforces unique username (case-insensitive via lowercase)", async () => {
    await User.create({ username: "Mary", passwordHash: "h", displayName: "Mary" });
    await expect(
      User.create({ username: "mary", passwordHash: "h2", displayName: "Mary 2" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("defaults status to ACTIVE and avatarUrl to null", async () => {
    const u = await User.create({ username: "john", passwordHash: "h", displayName: "John" });
    expect(u.status).toBe("ACTIVE");
    expect(u.avatarUrl).toBeNull();
  });
});

describe("Contact model", () => {
  it("enforces unique (ownerId, contactUserId) pair", async () => {
    const owner = oid();
    const contact = oid();
    await Contact.create({ ownerId: owner, contactUserId: contact });
    await expect(Contact.create({ ownerId: owner, contactUserId: contact })).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("allows the same contact user under a different owner", async () => {
    const contact = oid();
    await Contact.create({ ownerId: oid(), contactUserId: contact });
    await expect(Contact.create({ ownerId: oid(), contactUserId: contact })).resolves.toBeDefined();
  });
});

describe("Conversation model", () => {
  it("accepts exactly 2 participants", async () => {
    const conv = await Conversation.create({
      participants: [{ userId: oid() }, { userId: oid() }],
    });
    expect(conv.participants).toHaveLength(2);
    expect(conv.participants[0].unreadCount).toBe(0);
    expect(conv.participants[0].lastReadAt).toBeNull();
  });

  it("rejects fewer than 2 participants", async () => {
    await expect(
      Conversation.create({ participants: [{ userId: oid() }] }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });

  it("rejects more than 2 participants", async () => {
    await expect(
      Conversation.create({ participants: [{ userId: oid() }, { userId: oid() }, { userId: oid() }] }),
    ).rejects.toThrow(mongoose.Error.ValidationError);
  });
});

describe("Message model", () => {
  it("enforces clientId idempotency within a conversation", async () => {
    const conversationId = oid();
    const senderId = oid();
    await Message.create({ conversationId, senderId, clientId: "abc", text: "hi" });
    await expect(
      Message.create({ conversationId, senderId, clientId: "abc", text: "hi again" }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("allows the same clientId in different conversations", async () => {
    const senderId = oid();
    await Message.create({ conversationId: oid(), senderId, clientId: "dup", text: "a" });
    await expect(
      Message.create({ conversationId: oid(), senderId, clientId: "dup", text: "b" }),
    ).resolves.toBeDefined();
  });

  it("defaults status to SENT and stamps sentAt", async () => {
    const m = await Message.create({
      conversationId: oid(),
      senderId: oid(),
      clientId: "x",
      text: "hello",
    });
    expect(m.status).toBe("SENT");
    expect(m.sentAt).toBeInstanceOf(Date);
  });
});

describe("RefreshToken & Task models", () => {
  it("enforces unique tokenHash", async () => {
    await RefreshToken.create({ userId: oid(), tokenHash: "hash1", expiresAt: new Date(Date.now() + 1000) });
    await expect(
      RefreshToken.create({ userId: oid(), tokenHash: "hash1", expiresAt: new Date(Date.now() + 1000) }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("enforces unique task code", async () => {
    await Task.create({ code: "SEND_MESSAGE", title: "Send a message" });
    await expect(Task.create({ code: "SEND_MESSAGE", title: "dup" })).rejects.toMatchObject({
      code: 11000,
    });
  });
});

describe("§7.4 index declarations", () => {
  it("declares every required index", () => {
    const hasIndex = (model: mongoose.Model<any>, keys: Record<string, number>) =>
      model.schema.indexes().some(([def]) => JSON.stringify(def) === JSON.stringify(keys));

    expect(hasIndex(Contact, { ownerId: 1, contactUserId: 1 })).toBe(true);
    expect(hasIndex(Conversation, { "participants.userId": 1, lastMessageAt: -1 })).toBe(true);
    expect(hasIndex(Message, { conversationId: 1, sentAt: 1 })).toBe(true);
    expect(hasIndex(Message, { conversationId: 1, clientId: 1 })).toBe(true);
    expect(hasIndex(RefreshToken, { expiresAt: 1 })).toBe(true);

    // Field-level unique indexes (username/email/tokenHash/code) appear on the paths.
    expect(User.schema.path("username").options.unique).toBe(true);
    expect(Task.schema.path("code").options.unique).toBe(true);
  });
});
