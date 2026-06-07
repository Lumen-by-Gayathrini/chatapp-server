import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { bearer, registerAndAuth, type AuthedUser } from "../helpers/users";

const app = createApp();

// Minimal valid-ish JPEG header bytes — enough for an upload (no decoding happens).
const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

let mary: AuthedUser;

beforeEach(async () => {
  mary = await registerAndAuth(app, "mary", "Mary");
});

describe("POST /media", () => {
  it("uploads an image and returns { mediaId, url }", async () => {
    const res = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", jpegBuffer, { filename: "photo.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(201);
    expect(res.body.mediaId).toBeTruthy();
    expect(typeof res.body.url).toBe("string");
  });

  it("rejects a disallowed content type with 415", async () => {
    const res = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", Buffer.from("hello"), { filename: "note.txt", contentType: "text/plain" });
    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe("UNSUPPORTED_MEDIA_TYPE");
  });

  it("requires a file", async () => {
    const res = await request(app).post("/api/v1/media").set(bearer(mary.token));
    expect(res.status).toBe(400);
  });

  it("requires auth", async () => {
    const res = await request(app)
      .post("/api/v1/media")
      .attach("file", jpegBuffer, { filename: "photo.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(401);
  });
});

describe("image message (media → send)", () => {
  it("sends an IMAGE message referencing the uploaded media", async () => {
    const john = await registerAndAuth(app, "john", "John");
    const conv = await request(app)
      .post("/api/v1/conversations")
      .set(bearer(mary.token))
      .send({ peerUserId: john.user.id });

    const upload = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", jpegBuffer, { filename: "p.jpg", contentType: "image/jpeg" });

    const send = await request(app)
      .post(`/api/v1/conversations/${conv.body.id}/messages`)
      .set(bearer(mary.token))
      .send({ clientId: "img1", type: "IMAGE", mediaId: upload.body.mediaId });
    expect(send.status).toBe(201);
    expect(send.body.type).toBe("IMAGE");
    expect(send.body.mediaUrl).toBe(upload.body.url);
  });

  it("rejects referencing another user's media with 404", async () => {
    const john = await registerAndAuth(app, "john", "John");
    const conv = await request(app)
      .post("/api/v1/conversations")
      .set(bearer(mary.token))
      .send({ peerUserId: john.user.id });

    const upload = await request(app)
      .post("/api/v1/media")
      .set(bearer(mary.token))
      .attach("file", jpegBuffer, { filename: "p.jpg", contentType: "image/jpeg" });

    // John tries to send using Mary's mediaId.
    const send = await request(app)
      .post(`/api/v1/conversations/${conv.body.id}/messages`)
      .set(bearer(john.token))
      .send({ clientId: "img2", type: "IMAGE", mediaId: upload.body.mediaId });
    expect(send.status).toBe(404);
  });
});
