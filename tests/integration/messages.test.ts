import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

const app = createApp();

let mary: AuthedUser;
let john: AuthedUser;
let david: AuthedUser;
let conversationId: string;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
  david = await registerAndAuth(app, "david", "David");
  const conv = await request(app)
    .post("/api/v1/conversations")
    .set(bearer(mary.token))
    .send({ peerUserId: john.user.id });
  conversationId = conv.body.id;
});

const sendAs = (token: string, body: object) =>
  request(app)
    .post(`/api/v1/conversations/${conversationId}/messages`)
    .set(bearer(token))
    .send(body);

const listAs = (token: string, query = "") =>
  request(app)
    .get(`/api/v1/conversations/${conversationId}/messages${query}`)
    .set(bearer(token));

describe("POST messages — send + idempotency", () => {
  it("sends a text message (201) with senderId and SENT status", async () => {
    const res = await sendAs(mary.token, { clientId: "a", type: "TEXT", text: "Hello John" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      senderId: mary.user.id,
      type: "TEXT",
      text: "Hello John",
      status: "SENT",
    });
    expect(res.body.sentAt).toBeTruthy();
  });

  it("is idempotent on clientId (replay returns the same message, no duplicate)", async () => {
    const first = await sendAs(mary.token, { clientId: "dup", type: "TEXT", text: "Hi" });
    const replay = await sendAs(mary.token, { clientId: "dup", type: "TEXT", text: "Hi again" });
    expect(replay.status).toBe(200);
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.text).toBe("Hi"); // original preserved

    const list = await listAs(mary.token);
    expect(list.body.messages).toHaveLength(1);
  });

  it("rejects empty text and missing mediaId", async () => {
    expect((await sendAs(mary.token, { clientId: "e1", type: "TEXT", text: "  " })).status).toBe(400);
    expect((await sendAs(mary.token, { clientId: "e2", type: "IMAGE" })).status).toBe(400);
  });

  it("rejects a non-participant with 404", async () => {
    const res = await sendAs(david.token, { clientId: "x", type: "TEXT", text: "intruder" });
    expect(res.status).toBe(404);
  });
});

describe("send updates unread + lastMessage; read clears it", () => {
  it("increments the recipient unread and denormalizes lastMessage", async () => {
    await sendAs(mary.token, { clientId: "m1", type: "TEXT", text: "Hello John" });

    const johnList = await request(app).get("/api/v1/conversations").set(bearer(john.token));
    expect(johnList.body[0].unreadCount).toBe(1);
    expect(johnList.body[0].lastMessage).toMatchObject({ text: "Hello John", senderId: mary.user.id });

    // Sender does not accrue unread for their own message.
    const maryList = await request(app).get("/api/v1/conversations").set(bearer(mary.token));
    expect(maryList.body[0].unreadCount).toBe(0);

    // John reads → unread cleared.
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/read`)
      .set(bearer(john.token))
      .send({});
    const johnAfter = await request(app).get("/api/v1/conversations").set(bearer(john.token));
    expect(johnAfter.body[0].unreadCount).toBe(0);
  });
});

describe("GET messages — paging", () => {
  it("returns all with a past cursor and none with a future cursor", async () => {
    await sendAs(mary.token, { clientId: "p1", type: "TEXT", text: "one" });
    await sendAs(mary.token, { clientId: "p2", type: "TEXT", text: "two" });

    const all = await listAs(mary.token, "?since=1970-01-01T00:00:00.000Z");
    expect(all.body.messages).toHaveLength(2);
    expect(all.body.nextCursor).toBeTruthy();

    const none = await listAs(mary.token, "?since=2999-01-01T00:00:00.000Z");
    expect(none.body.messages).toHaveLength(0);

    const limited = await listAs(mary.token, "?limit=1");
    expect(limited.body.messages).toHaveLength(1);
  });
});
