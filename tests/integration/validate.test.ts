import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "../../src/middleware/validate";
import { errorHandler, notFoundHandler } from "../../src/middleware/error";

/** A throwaway app exercising the validate middleware + error envelope handler. */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.post(
    "/echo",
    validate({
      body: z.object({ name: z.string().min(1), age: z.coerce.number().int().min(0) }),
    }),
    (req, res) => res.status(200).json({ received: req.body }),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

describe("validate middleware", () => {
  const app = makeApp();

  it("passes valid input through and coerces types", async () => {
    const res = await request(app).post("/echo").send({ name: "Mary", age: "70" });
    expect(res.status).toBe(200);
    expect(res.body.received).toEqual({ name: "Mary", age: 70 });
  });

  it("returns the standard VALIDATION_ERROR envelope on bad input", async () => {
    const res = await request(app).post("/echo").send({ name: "", age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(res.body.error.details.fields)).toBe(true);
    const paths = res.body.error.details.fields.map((f: { path: string }) => f.path);
    expect(paths).toContain("body.name");
    expect(paths).toContain("body.age");
  });

  it("rejects malformed JSON with a 400 envelope", async () => {
    const res = await request(app)
      .post("/echo")
      .set("content-type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
