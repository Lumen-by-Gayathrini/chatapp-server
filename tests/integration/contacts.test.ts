import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

const app = createApp();

let mary: AuthedUser;
let john: AuthedUser;
let david: AuthedUser;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
  david = await registerAndAuth(app, "david", "David");
});

const post = (body: object) =>
  request(app).post("/api/v1/contacts").set(bearer(mary.token)).send(body);

describe("GET /contacts", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/v1/contacts")).status).toBe(401);
  });

  it("starts empty", async () => {
    const res = await request(app).get("/api/v1/contacts").set(bearer(mary.token));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /contacts", () => {
  it("adds a contact by username (nested user DTO)", async () => {
    const res = await post({ username: "john" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ user: { username: "john", displayName: "John" }, alias: null });
    expect(res.body.id).toBeTruthy();
  });

  it("adds a contact by userId", async () => {
    const res = await post({ userId: david.user.id });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe("david");
  });

  it("rejects a duplicate with 409 DUPLICATE_CONTACT", async () => {
    await post({ username: "john" });
    const res = await post({ username: "john" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("DUPLICATE_CONTACT");
  });

  it("returns 404 for an unknown user", async () => {
    const res = await post({ username: "ghost" });
    expect(res.status).toBe(404);
  });

  it("rejects adding yourself", async () => {
    const res = await post({ username: "mary" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires username or userId", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /contacts/:id", () => {
  it("sets an alias", async () => {
    const created = await post({ username: "john" });
    const res = await request(app)
      .patch(`/api/v1/contacts/${created.body.id}`)
      .set(bearer(mary.token))
      .send({ alias: "Johnny" });
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe("Johnny");
  });

  it("rejects a malformed id with 400", async () => {
    const res = await request(app)
      .patch("/api/v1/contacts/not-an-id")
      .set(bearer(mary.token))
      .send({ alias: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing contact", async () => {
    const res = await request(app)
      .patch(`/api/v1/contacts/${new mongoose.Types.ObjectId().toString()}`)
      .set(bearer(mary.token))
      .send({ alias: "x" });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /contacts/:id", () => {
  it("removes a contact (204), then 404 on repeat", async () => {
    const created = await post({ username: "john" });
    const del = await request(app)
      .delete(`/api/v1/contacts/${created.body.id}`)
      .set(bearer(mary.token));
    expect(del.status).toBe(204);

    const list = await request(app).get("/api/v1/contacts").set(bearer(mary.token));
    expect(list.body).toHaveLength(0);

    const again = await request(app)
      .delete(`/api/v1/contacts/${created.body.id}`)
      .set(bearer(mary.token));
    expect(again.status).toBe(404);
  });
});

describe("contact isolation between users", () => {
  it("does not leak one user's contacts to another", async () => {
    await post({ username: "john" });
    const johnList = await request(app).get("/api/v1/contacts").set(bearer(john.token));
    expect(johnList.body).toHaveLength(0);
  });
});
