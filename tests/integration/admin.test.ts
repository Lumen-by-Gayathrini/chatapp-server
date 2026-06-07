import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../../src/app";
import { authAdmin, bearer, registerAndAuth, type AuthedAdmin, type AuthedUser } from "../helpers/users";

const app = createApp();

let admin: AuthedAdmin;
let mary: AuthedUser;
let john: AuthedUser;

beforeEach(async () => {
  admin = await authAdmin(app);
  mary = await registerAndAuth(app, "mary", "Mary");
  john = await registerAndAuth(app, "john", "John");
});

const asAdmin = () => bearer(admin.token);

describe("admin auth gate", () => {
  it("rejects no token and participant tokens on /admin/*", async () => {
    expect((await request(app).get("/api/v1/admin/users")).status).toBe(401);
    expect(
      (await request(app).get("/api/v1/admin/users").set(bearer(mary.token))).status,
    ).toBe(401);
  });
});

describe("user management", () => {
  it("lists, creates, gets and updates participants", async () => {
    const list = await request(app).get("/api/v1/admin/users").set(asAdmin());
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(2);

    const created = await request(app)
      .post("/api/v1/admin/users")
      .set(asAdmin())
      .send({ username: "emma", displayName: "Emma", password: "secret1" });
    expect(created.status).toBe(201);
    expect(created.body.username).toBe("emma");

    const dup = await request(app)
      .post("/api/v1/admin/users")
      .set(asAdmin())
      .send({ username: "emma", displayName: "Emma", password: "secret1" });
    expect(dup.status).toBe(409);

    const got = await request(app)
      .get(`/api/v1/admin/users/${created.body.id}`)
      .set(asAdmin());
    expect(got.status).toBe(200);

    const missing = await request(app)
      .get(`/api/v1/admin/users/${new mongoose.Types.ObjectId().toString()}`)
      .set(asAdmin());
    expect(missing.status).toBe(404);
  });

  it("deactivates a user (blocking their login) and resets passwords", async () => {
    const deact = await request(app)
      .patch(`/api/v1/admin/users/${mary.user.id}`)
      .set(asAdmin())
      .send({ status: "INACTIVE" });
    expect(deact.status).toBe(200);
    expect(deact.body.status).toBe("INACTIVE");

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "mary", password: "secret1" });
    expect(login.status).toBe(403);

    // Reactivate + reset password.
    await request(app)
      .patch(`/api/v1/admin/users/${mary.user.id}`)
      .set(asAdmin())
      .send({ status: "ACTIVE" });
    const reset = await request(app)
      .post(`/api/v1/admin/users/${mary.user.id}/reset-password`)
      .set(asAdmin())
      .send({ newPassword: "newsecret1" });
    expect(reset.status).toBe(204);

    expect(
      (await request(app).post("/api/v1/auth/login").send({ username: "mary", password: "secret1" }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/login")
          .send({ username: "mary", password: "newsecret1" })
      ).status,
    ).toBe(200);
  });
});

describe("contacts on behalf of users", () => {
  it("adds reciprocal contacts visible to both users", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/users/${mary.user.id}/contacts`)
      .set(asAdmin())
      .send({ contactUserId: john.user.id, reciprocal: true });
    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(2);

    const maryContacts = await request(app).get("/api/v1/contacts").set(bearer(mary.token));
    expect(maryContacts.body[0].user.username).toBe("john");
    const johnContacts = await request(app).get("/api/v1/contacts").set(bearer(john.token));
    expect(johnContacts.body[0].user.username).toBe("mary");
  });

  it("removes a contact on behalf of a user", async () => {
    const added = await request(app)
      .post(`/api/v1/admin/users/${mary.user.id}/contacts`)
      .set(asAdmin())
      .send({ contactUserId: john.user.id });
    const del = await request(app)
      .delete(`/api/v1/admin/users/${mary.user.id}/contacts/${added.body[0].id}`)
      .set(asAdmin());
    expect(del.status).toBe(204);
  });
});

describe("conversation monitoring & chat simulation", () => {
  it("ensures a conversation (201 then 200) and lists it by user", async () => {
    const first = await request(app)
      .post("/api/v1/admin/conversations")
      .set(asAdmin())
      .send({ participantIds: [mary.user.id, john.user.id] });
    expect(first.status).toBe(201);

    const again = await request(app)
      .post("/api/v1/admin/conversations")
      .set(asAdmin())
      .send({ participantIds: [mary.user.id, john.user.id] });
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);

    const list = await request(app)
      .get(`/api/v1/admin/conversations?userId=${mary.user.id}`)
      .set(asAdmin());
    expect(list.body).toHaveLength(1);
  });

  it("simulation as a participant is reflected in the recipient's poll", async () => {
    const conv = await request(app)
      .post("/api/v1/admin/conversations")
      .set(asAdmin())
      .send({ participantIds: [mary.user.id, john.user.id] });

    // Researcher sends AS John.
    const sim = await request(app)
      .post(`/api/v1/admin/conversations/${conv.body.id}/messages`)
      .set(asAdmin())
      .send({ asUserId: john.user.id, type: "TEXT", text: "Hello Mary" });
    expect(sim.status).toBe(201);
    expect(sim.body.senderId).toBe(john.user.id);

    // Mary polls her conversation and sees it.
    const poll = await request(app)
      .get(`/api/v1/conversations/${conv.body.id}/messages?since=1970-01-01T00:00:00.000Z`)
      .set(bearer(mary.token));
    expect(poll.body.messages).toHaveLength(1);
    expect(poll.body.messages[0].text).toBe("Hello Mary");

    const maryConvs = await request(app).get("/api/v1/conversations").set(bearer(mary.token));
    expect(maryConvs.body[0].unreadCount).toBe(1);

    // Admin can monitor the thread too.
    const monitor = await request(app)
      .get(`/api/v1/admin/conversations/${conv.body.id}/messages`)
      .set(asAdmin());
    expect(monitor.body.messages).toHaveLength(1);
  });

  it("rejects act-as-user for a non-participant (403)", async () => {
    const david = await registerAndAuth(app, "david", "David");
    const conv = await request(app)
      .post("/api/v1/admin/conversations")
      .set(asAdmin())
      .send({ participantIds: [mary.user.id, john.user.id] });

    const sim = await request(app)
      .post(`/api/v1/admin/conversations/${conv.body.id}/messages`)
      .set(asAdmin())
      .send({ asUserId: david.user.id, type: "TEXT", text: "intruder" });
    expect(sim.status).toBe(403);
  });

  it("a participant token cannot simulate", async () => {
    const conv = await request(app)
      .post("/api/v1/admin/conversations")
      .set(asAdmin())
      .send({ participantIds: [mary.user.id, john.user.id] });
    const sim = await request(app)
      .post(`/api/v1/admin/conversations/${conv.body.id}/messages`)
      .set(bearer(mary.token))
      .send({ asUserId: mary.user.id, type: "TEXT", text: "nope" });
    expect(sim.status).toBe(401);
  });
});

describe("tasks & task-attempts", () => {
  it("creates tasks, assigns and updates attempts with metrics", async () => {
    const task = await request(app)
      .post("/api/v1/admin/tasks")
      .set(asAdmin())
      .send({ code: "SEND_MESSAGE", title: "Send a message" });
    expect(task.status).toBe(201);

    const dup = await request(app)
      .post("/api/v1/admin/tasks")
      .set(asAdmin())
      .send({ code: "SEND_MESSAGE", title: "dup" });
    expect(dup.status).toBe(409);

    const assign = await request(app)
      .post(`/api/v1/admin/tasks/${task.body.id}/assign`)
      .set(asAdmin())
      .send({ participantId: mary.user.id });
    expect(assign.status).toBe(201);
    expect(assign.body.status).toBe("ASSIGNED");

    const attempts = await request(app)
      .get(`/api/v1/admin/task-attempts?participantId=${mary.user.id}`)
      .set(asAdmin());
    expect(attempts.body).toHaveLength(1);

    const updated = await request(app)
      .patch(`/api/v1/admin/task-attempts/${assign.body.id}`)
      .set(asAdmin())
      .send({ status: "COMPLETED", metrics: { durationMs: 4200, errorCount: 1, helpRequests: 0 } });
    expect(updated.status).toBe(200);
    expect(updated.body.status).toBe("COMPLETED");
    expect(updated.body.completedAt).toBeTruthy();
    expect(updated.body.metrics).toMatchObject({ durationMs: 4200, errorCount: 1, helpRequests: 0 });
  });
});
