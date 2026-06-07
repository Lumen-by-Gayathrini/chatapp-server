import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import {
  toContactDto,
  toConversationDto,
  toMessageDto,
  toTaskAttemptDto,
  toTaskDto,
  toUserDto,
} from "../../src/lib/serialize";

const oid = () => new Types.ObjectId();

const fakeUser = (over: Partial<Record<string, unknown>> = {}) => ({
  _id: oid(),
  username: "mary",
  displayName: "Mary",
  avatarUrl: null,
  status: "ACTIVE",
  ...over,
});

describe("toUserDto", () => {
  it("maps _id → id and defaults avatarUrl to null", () => {
    const u = fakeUser();
    const dto = toUserDto(u as never);
    expect(dto).toEqual({
      id: u._id.toString(),
      username: "mary",
      displayName: "Mary",
      avatarUrl: null,
      status: "ACTIVE",
    });
  });
});

describe("toContactDto", () => {
  it("nests the user and normalizes a missing alias to null", () => {
    const contact = { _id: oid(), alias: undefined };
    const dto = toContactDto(contact as never, fakeUser() as never);
    expect(dto.id).toBe(contact._id.toString());
    expect(dto.user.username).toBe("mary");
    expect(dto.alias).toBeNull();
  });
});

describe("toConversationDto", () => {
  const callerId = oid().toString();
  const peer = fakeUser({ username: "john", displayName: "John" });

  it("renders peer + the caller's own unreadCount, with a null lastMessage", () => {
    const conv = {
      _id: oid(),
      participants: [
        { userId: new Types.ObjectId(callerId), unreadCount: 3 },
        { userId: peer._id, unreadCount: 9 },
      ],
      lastMessage: null,
      lastMessageAt: null,
    };
    const dto = toConversationDto(conv as never, callerId, peer as never);
    expect(dto.peer.username).toBe("john");
    expect(dto.unreadCount).toBe(3); // caller's, not peer's
    expect(dto.lastMessage).toBeNull();
    expect(dto.lastMessageAt).toBeNull();
  });

  it("serializes a denormalized lastMessage with ISO timestamps", () => {
    const sentAt = new Date("2026-06-05T09:21:00.000Z");
    const conv = {
      _id: oid(),
      participants: [{ userId: new Types.ObjectId(callerId), unreadCount: 0 }, { userId: peer._id }],
      lastMessage: { text: "hi", type: "TEXT", senderId: peer._id, sentAt },
      lastMessageAt: sentAt,
    };
    const dto = toConversationDto(conv as never, callerId, peer as never);
    expect(dto.lastMessage).toEqual({
      text: "hi",
      type: "TEXT",
      senderId: peer._id.toString(),
      sentAt: sentAt.toISOString(),
    });
    expect(dto.lastMessageAt).toBe(sentAt.toISOString());
  });
});

describe("toMessageDto", () => {
  it("includes senderId and ISO sentAt", () => {
    const sentAt = new Date("2026-06-05T09:21:00.000Z");
    const msg = {
      _id: oid(),
      clientId: "c1",
      conversationId: oid(),
      senderId: oid(),
      type: "TEXT",
      text: "Hello",
      mediaUrl: null,
      status: "SENT",
      sentAt,
    };
    const dto = toMessageDto(msg as never);
    expect(dto.senderId).toBe(msg.senderId.toString());
    expect(dto.sentAt).toBe(sentAt.toISOString());
    expect(dto.type).toBe("TEXT");
    expect(dto.mediaUrl).toBeNull();
  });
});

describe("toTaskDto / toTaskAttemptDto", () => {
  it("maps task fields", () => {
    const task = { _id: oid(), code: "SEND_MESSAGE", title: "Send", description: undefined };
    expect(toTaskDto(task as never)).toMatchObject({ code: "SEND_MESSAGE", title: "Send", description: null });
  });

  it("maps attempt metrics and stamps", () => {
    const completedAt = new Date("2026-06-05T10:00:00.000Z");
    const attempt = {
      _id: oid(),
      taskId: oid(),
      participantId: oid(),
      status: "COMPLETED",
      metrics: { durationMs: 4200, errorCount: 1, helpRequests: 0 },
      notes: null,
      startedAt: null,
      completedAt,
    };
    const dto = toTaskAttemptDto(attempt as never);
    expect(dto.status).toBe("COMPLETED");
    expect(dto.metrics).toEqual({ durationMs: 4200, errorCount: 1, helpRequests: 0 });
    expect(dto.completedAt).toBe(completedAt.toISOString());
    expect(dto.startedAt).toBeNull();
  });
});
