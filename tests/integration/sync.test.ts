import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

const app = createApp();

let mary: AuthedUser;
let john: AuthedUser;
let conversationId: string;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
  const conv = await request(app)
    .post("/api/v1/conversations")
    .set(bearer(mary.token))
    .send({ peerUserId: john.user.id });
  conversationId = conv.body.id;
});

describe("GET /sync", () => {
  it("returns all conversations and a serverTime without a cursor", async () => {
    const res = await request(app).get("/api/v1/sync").set(bearer(mary.token));
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.messages).toEqual([]);
    expect(res.body.serverTime).toBeTruthy();
  });

  it("delivers new messages and the changed conversation since a cursor", async () => {
    // Establish a baseline cursor for John.
    const base = await request(app).get("/api/v1/sync").set(bearer(john.token));
    const cursor = base.body.serverTime;

    // Mary sends a message after the cursor.
    await request(app)
      .post(`/api/v1/conversations/${conversationId}/messages`)
      .set(bearer(mary.token))
      .send({ clientId: "s1", type: "TEXT", text: "Hello John" });

    const res = await request(app)
      .get(`/api/v1/sync?since=${encodeURIComponent(cursor)}`)
      .set(bearer(john.token));
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].text).toBe("Hello John");
    expect(res.body.conversations).toHaveLength(1);
    expect(res.body.conversations[0].unreadCount).toBe(1);
  });

  it("rejects a malformed cursor with 400", async () => {
    const res = await request(app).get("/api/v1/sync?since=not-a-date").set(bearer(mary.token));
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    expect((await request(app).get("/api/v1/sync")).status).toBe(401);
  });
});
