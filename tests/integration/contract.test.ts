import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

/**
 * Contract tests (TDD §11). Assert that response **shapes and status codes** match the
 * mobile client's expectations (chatapp `Dtos.kt` / app TDD §7), including the `senderId`
 * refinement. Keys are checked exactly so an accidental field add/removal is caught.
 */
const app = createApp();

const keys = (o: object) => Object.keys(o).sort();
const USER_KEYS = ["avatarUrl", "displayName", "id", "status", "username"];
const MESSAGE_KEYS = [
  "clientId",
  "conversationId",
  "id",
  "mediaUrl",
  "senderId",
  "sentAt",
  "status",
  "text",
  "type",
];

let mary: AuthedUser;
let john: AuthedUser;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
});

describe("auth + profile contract", () => {
  it("register/login return { user, accessToken, refreshToken } with a UserDto", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "mary", password: "secret1" });
    expect(res.status).toBe(200);
    expect(keys(res.body)).toEqual(["accessToken", "refreshToken", "user"]);
    expect(keys(res.body.user)).toEqual(USER_KEYS);
  });

  it("refresh returns { accessToken, refreshToken }", async () => {
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .send({ refreshToken: mary.refreshToken });
    expect(res.status).toBe(200);
    expect(keys(res.body)).toEqual(["accessToken", "refreshToken"]);
  });

  it("GET /me returns a UserDto", async () => {
    const res = await request(app).get("/api/v1/me").set(bearer(mary.token));
    expect(keys(res.body)).toEqual(USER_KEYS);
  });
});

describe("contacts contract", () => {
  it("ContactDto = { id, user, alias }", async () => {
    const res = await request(app)
      .post("/api/v1/contacts")
      .set(bearer(mary.token))
      .send({ username: "john" });
    expect(res.status).toBe(201);
    expect(keys(res.body)).toEqual(["alias", "id", "user"]);
    expect(keys(res.body.user)).toEqual(USER_KEYS);
    expect(res.body.alias).toBeNull();
  });
});

describe("conversations + messages contract", () => {
  it("ConversationDto shape and 201/200 idempotency", async () => {
    const created = await request(app)
      .post("/api/v1/conversations")
      .set(bearer(mary.token))
      .send({ peerUserId: john.user.id });
    expect(created.status).toBe(201);
    expect(keys(created.body)).toEqual([
      "id",
      "lastMessage",
      "lastMessageAt",
      "peer",
      "unreadCount",
    ]);
    expect(keys(created.body.peer)).toEqual(USER_KEYS);
    expect(created.body.lastMessage).toBeNull();
    expect(created.body.lastMessageAt).toBeNull();

    const existing = await request(app)
      .post("/api/v1/conversations")
      .set(bearer(mary.token))
      .send({ peerUserId: john.user.id });
    expect(existing.status).toBe(200);
  });

  it("MessageDto includes senderId; lastMessage denormalized with its shape", async () => {
    const conv = await request(app)
      .post("/api/v1/conversations")
      .set(bearer(mary.token))
      .send({ peerUserId: john.user.id });

    const sent = await request(app)
      .post(`/api/v1/conversations/${conv.body.id}/messages`)
      .set(bearer(mary.token))
      .send({ clientId: "c1", type: "TEXT", text: "Hello" });
    expect(sent.status).toBe(201);
    expect(keys(sent.body)).toEqual(MESSAGE_KEYS);
    expect(sent.body.senderId).toBe(mary.user.id);
    expect(sent.body.status).toBe("SENT");

    const list = await request(app)
      .get(`/api/v1/conversations/${conv.body.id}/messages`)
      .set(bearer(mary.token));
    expect(keys(list.body)).toEqual(["messages", "nextCursor"]);

    const convList = await request(app).get("/api/v1/conversations").set(bearer(john.token));
    expect(keys(convList.body[0].lastMessage)).toEqual(["senderId", "sentAt", "text", "type"]);
  });
});

describe("media + sync contract", () => {
  it("media upload returns { mediaId, url }", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const res = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", jpeg, { filename: "p.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(keys(res.body)).toEqual(["mediaId", "url"]);
  });

  it("sync returns { conversations, messages, serverTime }", async () => {
    const res = await request(app).get("/api/v1/sync").set(bearer(mary.token));
    expect(keys(res.body)).toEqual(["conversations", "messages", "serverTime"]);
  });
});

describe("error envelope contract", () => {
  it("4xx responses use { error: { code, message } }", async () => {
    const res = await request(app).get("/api/v1/me"); // no token
    expect(res.status).toBe(401);
    expect(keys(res.body)).toEqual(["error"]);
    expect(res.body.error).toHaveProperty("code");
    expect(res.body.error).toHaveProperty("message");
  });
});
