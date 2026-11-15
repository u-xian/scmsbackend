/*
  Activations and card details: reads, validation and unknown ids.
  The approval workflow itself is tested in tests/approvalWorkflow.test.js
  and the card range rules in tests/cardRanges.test.js.
*/
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { db, PROFILES, TEST_PREFIX, loginAs, uniqueName, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

let submitter, accountant, dealer, denomination;
beforeEach(async () => {
  submitter = await loginAs(PROFILES.ADMIN, { name: "Sam Submitter" });
  accountant = await loginAs(PROFILES.ACCOUNTING);
  dealer = await db.Dealers.create({ dealername: uniqueName("dealer"), status: true });
  denomination = await db.Denominations.create({
    label: uniqueName("1000 RWF "),
    pinspercard: 1,
    pinsvalue: 1000,
    status: true,
  });
});

let serial = 0;
const rangeBody = (act_id, overrides = {}) => {
  serial += 1;
  return {
    batch: `${TEST_PREFIX}A${Date.now()}`,
    start_serialnumber: `${serial}00`,
    end_serialnumber: `${serial}99`,
    pins: 100,
    cards: 100,
    denom_id: denomination.id,
    act_id,
    ...overrides,
  };
};

async function draftWithRange() {
  const id = (await submitter.post("/activations").send({ dealer_id: dealer.id })).body.data.activId;
  await submitter.post("/carddetails").send(rangeBody(id)).expect(200);
  return id;
}

describe("activations API", () => {
  it("POST /activations answers the new id, its number and state", async () => {
    const res = await submitter.post("/activations").send({ dealer_id: dealer.id });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: "draft", status: 1, statusMessage: "Activation created!" });
    const activation = await db.Activations.findByPk(res.body.data.activId);
    expect(activation.actno).toMatch(/^SCMS\d{14}[A-Z]{3}$/);
    expect(activation.dealer_id).toBe(dealer.id);
  });

  it.each([
    [{}, '"dealer_id" is required'],
    [{ dealer_id: "abc" }, '"dealer_id" must be a number'],
    [{ dealer_id: 1, note: "x" }, '"note" is not allowed'],
  ])("POST /activations refuses %j", async (body, message) => {
    const res = await submitter.post("/activations").send(body);
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it("GET /activations/activbyprofile/0 lists activations with agent, dealer, ranges and history", async () => {
    const id = await draftWithRange();
    const res = await accountant.get("/activations/activbyprofile/0");
    expect(res.status).toBe(200);
    const found = res.body.data.find((a) => a.id === id);
    expect(found).toMatchObject({
      state: "draft",
      agents: { id: submitter.user.id, name: "Sam Submitter" },
      dealers: { id: dealer.id, dealername: dealer.dealername },
    });
    expect(found.cardsdetails).toHaveLength(1);
    expect(found.cardsdetails[0].denominations).toEqual({ id: denomination.id, label: denomination.label });
    expect(found.events.map((e) => e.action)).toEqual(["created"]);
    expect(found.events[0].user).toEqual({ id: submitter.user.id, name: "Sam Submitter" });
  });

  it("GET /activations/activbyprofile lists the newest first", async () => {
    const older = await draftWithRange();
    const newer = await draftWithRange();
    const ids = (await accountant.get("/activations/activbyprofile/0")).body.data.map((a) => a.id);
    expect(ids.indexOf(newer)).toBeLessThan(ids.indexOf(older));
  });

  it("GET /activations/:id returns one activation with its history; 404; 400", async () => {
    const id = await draftWithRange();
    const res = await accountant.get(`/activations/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, state: "draft", dealer_id: dealer.id });
    expect(res.body.data.events).toHaveLength(1);
    expect((await accountant.get("/activations/99999999")).status).toBe(404);
    expect((await accountant.get("/activations/abc")).status).toBe(400);
  });

  it("a deleted activation is no longer found", async () => {
    const id = await draftWithRange();
    await submitter.delete(`/activations/${id}`).expect(204);
    expect((await accountant.get(`/activations/${id}`)).status).toBe(404);
    const ids = (await accountant.get("/activations/activbyprofile/0")).body.data.map((a) => a.id);
    expect(ids).not.toContain(id);
  });

  it("PUT /activations/:id changes the dealer of a draft; validates", async () => {
    const id = await draftWithRange();
    const other = await db.Dealers.create({ dealername: uniqueName("dealer"), status: true });
    await submitter.put(`/activations/${id}`).send({ dealer_id: other.id }).expect(200);
    expect((await db.Activations.findByPk(id)).dealer_id).toBe(other.id);
    expect((await submitter.put(`/activations/${id}`).send({})).status).toBe(400);
  });

  it.each([
    ["put", "/activations/99999999", { dealer_id: 1 }],
    ["put", "/activations/submit/99999999", {}],
    ["put", "/activations/approve/99999999", {}],
    ["put", "/activations/reject/99999999", { reason: "Unknown one" }],
    ["put", "/activations/resubmit/99999999", {}],
    ["delete", "/activations/99999999", undefined],
  ])("%s %s answers 404 for an unknown activation", async (method, path, body) => {
    const res = await submitter[method](path).send(body);
    expect(res.status).toBe(404);
    expect(res.text).toBe("Activation  not found");
  });

  it("send and send again accept only a short optional comment", async () => {
    const id = await draftWithRange();
    const res = await submitter.put(`/activations/submit/${id}`).send({ comment: "x".repeat(1001) });
    expect(res.status).toBe(400);
    expect((await submitter.put(`/activations/submit/${id}`).send({ other: 1 })).status).toBe(400);
  });

  // BUG: dealer_id is not checked: an activation can name a missing dealer.
  it.fails("BUG: an activation can be created for a dealer that does not exist", async () => {
    const res = await submitter.post("/activations").send({ dealer_id: 99999999 });
    expect(res.status).toBe(404);
  });
});

describe("card details API", () => {
  it("GET /carddetails lists ranges, newest first, with their denomination", async () => {
    const first = await draftWithRange();
    const second = await draftWithRange();
    const res = await accountant.get("/carddetails");
    expect(res.status).toBe(200);
    const mine = res.body.data.filter((c) => [first, second].includes(c.act_id));
    expect(mine.map((c) => c.act_id)).toEqual([second, first]);
    expect(mine[0].denominations).toMatchObject({ id: denomination.id, label: denomination.label });
    expect(mine[0]).toMatchObject({ status: false, activated_at: null });
  });

  it("GET /carddetails/:id returns one range; 404; 400", async () => {
    const id = await draftWithRange();
    const range = await db.Cardsdetails.findOne({ where: { act_id: id } });
    const res = await accountant.get(`/carddetails/${range.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: range.id,
      batch: range.batch,
      start_serialnumber: range.start_serialnumber,
      act_id: id,
    });
    expect((await accountant.get("/carddetails/99999999")).status).toBe(404);
    expect((await accountant.get("/carddetails/abc")).status).toBe(400);
  });

  it.each([
    [{ batch: undefined }, '"batch" is required'],
    [{ pins: "many" }, '"pins" must be a number'],
    [{ act_id: undefined }, '"act_id" is required'],
    [{ denom_id: undefined }, '"denom_id" is required'],
  ])("POST /carddetails refuses %j", async (overrides, message) => {
    const id = (await submitter.post("/activations").send({ dealer_id: dealer.id })).body.data.activId;
    const res = await submitter.post("/carddetails").send(rangeBody(id, overrides));
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it("POST /carddetails answers 404 for an unknown activation", async () => {
    const res = await submitter.post("/carddetails").send(rangeBody(99999999));
    expect(res.status).toBe(404);
  });

  it("PUT /carddetails/:id updates a range of a draft; 404 when unknown", async () => {
    const id = await draftWithRange();
    const range = await db.Cardsdetails.findOne({ where: { act_id: id } });
    const body = rangeBody(id, { batch: range.batch, cards: 50, pins: 50 });
    await submitter.put(`/carddetails/${range.id}`).send(body).expect(200);
    await range.reload();
    expect(range).toMatchObject({ cards: 50, pins: 50, start_serialnumber: body.start_serialnumber });
    expect((await submitter.put("/carddetails/99999999").send(body)).status).toBe(404);
  });

  it("DELETE /carddetails/:id deletes one range; 404 when unknown", async () => {
    const id = await draftWithRange();
    await submitter.post("/carddetails").send(rangeBody(id)).expect(200);
    const [range] = await db.Cardsdetails.findAll({ where: { act_id: id } });
    expect((await submitter.delete(`/carddetails/${range.id}`)).status).toBe(204);
    expect(await db.Cardsdetails.count({ where: { act_id: id } })).toBe(1);
    expect((await submitter.delete(`/carddetails/${range.id}`)).status).toBe(404);
  });

  it("DELETE /carddetails/deletebyactivId/:id answers 404 for an unknown activation", async () => {
    expect((await submitter.delete("/carddetails/deletebyactivId/99999999")).status).toBe(404);
  });

  // BUG: denom_id is not checked: a range can name a missing denomination.
  it.fails("BUG: a card range can use a denomination that does not exist", async () => {
    const id = (await submitter.post("/activations").send({ dealer_id: dealer.id })).body.data.activId;
    const res = await submitter.post("/carddetails").send(rangeBody(id, { denom_id: 99999999 }));
    expect(res.status).toBe(404);
  });
});
