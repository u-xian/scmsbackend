import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { api, db, PROFILES, TEST_PREFIX, tokenFor, cleanUp } = require("./helpers/testApp");

const admin = () => tokenFor(PROFILES.ADMIN);

describe("errors no longer stop the server", () => {
  beforeAll(cleanUp);
  afterAll(async () => {
    await cleanUp();
    await db.sequelize.close();
  });

  it("answers 400 to an id that is not a number, and keeps running", async () => {
    const res = await api().get("/api/v1/dealers/abc").set("x-auth-token", await admin());
    expect(res.status).toBe(400);
    expect(res.text).toBe("Invalid input");

    const next = await api().get("/api/v1/dealers").set("x-auth-token", await admin());
    expect(next.status).toBe(200);
  });

  it("answers 500 without details when the database fails unexpectedly", async () => {
    const spy = vi
      .spyOn(db.Dealers, "findAll")
      .mockRejectedValueOnce(new Error("connection lost"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await api().get("/api/v1/dealers").set("x-auth-token", await admin());
    expect(res.status).toBe(500);
    expect(res.text).toBe("Internal server error");
    expect(log).toHaveBeenCalled();

    spy.mockRestore();
    log.mockRestore();
  });

  it("answers 400 to a malformed JSON body", async () => {
    const res = await api()
      .post("/api/v1/dealers")
      .set("x-auth-token", await admin())
      .set("content-type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
  });

  it("creates card details (findFirst replaced by findOne) and detects duplicates", async () => {
    const token = await admin();
    const activation = await api()
      .post("/api/v1/activations")
      .set("x-auth-token", token)
      .send({ dealer_id: 1 });
    const card = {
      batch: `${TEST_PREFIX}B1`,
      start_serialnumber: "0001",
      end_serialnumber: "0100",
      pins: 100,
      cards: 100,
      denom_id: 1,
      act_id: activation.body.data.activId,
    };
    const first = await api().post("/api/v1/carddetails").set("x-auth-token", token).send(card);
    expect(first.status).toBe(200);

    const duplicate = await api().post("/api/v1/carddetails").set("x-auth-token", token).send(card);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error).toMatch(/overlap/);
  });
});
