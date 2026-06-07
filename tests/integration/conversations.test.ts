import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

const app = createApp();

let mary: AuthedUser;
let john: AuthedUser;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
});

const createConv = (peerUserId: string, token = mary.token) =>
  request(app).post("/api/v1/conversations").set(bearer(token)).send({ peerUserId });

describe("POST /conversations (idempotent)", () => {
  it("creates a conversation (201) with the peer and zero unread", async () => {
    const res = await createConv(john.user.id);
    expect(res.status).toBe(201);
    expect(res.body.peer.username).toBe("john");
    expect(res.body.unreadCount).toBe(0);
    expect(res.body.lastMessage).toBeNull();
  });

  it("returns the existing conversation (200) on repeat", async () => {
    const first = await createConv(john.user.id);
    const second = await createConv(john.user.id);
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);
  });

  it("rejects a self conversation with 400", async () => {
    const res = await createConv(mary.user.id);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown peer", async () => {
    const res = await createConv(new mongoose.Types.ObjectId().toString());
    expect(res.status).toBe(404);
  });

  it("requires auth", async () => {
    const res = await request(app).post("/api/v1/conversations").send({ peerUserId: john.user.id });
    expect(res.status).toBe(401);
  });
});

describe("GET /conversations", () => {
  it("lists the caller's conversations", async () => {
    await createConv(john.user.id);
    const res = await request(app).get("/api/v1/conversations").set(bearer(mary.token));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].peer.username).toBe("john");
  });
});

describe("DELETE /conversations/:id + read", () => {
  it("marks read (204) then deletes (204), then 404 on repeat", async () => {
    const { body } = await createConv(john.user.id);

    const read = await request(app)
      .post(`/api/v1/conversations/${body.id}/read`)
      .set(bearer(mary.token))
      .send({});
    expect(read.status).toBe(204);

    const del = await request(app)
      .delete(`/api/v1/conversations/${body.id}`)
      .set(bearer(mary.token));
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/v1/conversations").set(bearer(mary.token));
    expect(list.body).toHaveLength(0);

    const again = await request(app)
      .delete(`/api/v1/conversations/${body.id}`)
      .set(bearer(mary.token));
    expect(again.status).toBe(404);
  });
});
