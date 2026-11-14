import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { api, db, PROFILES, TEST_PREFIX, tokenForUser, createUser, cleanUp } =
  require("./helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

let submitter, accountant, billing, batch;
beforeEach(async () => {
  const make = async (profil_id) => {
    const { user } = await createUser({ profil_id });
    return { user, token: tokenForUser(user) };
  };
  submitter = await make(PROFILES.ADMIN);
  accountant = await make(PROFILES.ACCOUNTING);
  billing = await make(PROFILES.BILLING);
  batch = `${TEST_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
});

async function newActivation() {
  const res = await api()
    .post("/api/v1/activations")
    .set("x-auth-token", submitter.token)
    .send({ dealer_id: 1 });
  return res.body.data.activId;
}

const range = (act_id, start, end, extra = {}) => ({
  batch,
  start_serialnumber: start,
  end_serialnumber: end,
  pins: 10,
  cards: 10,
  denom_id: 1,
  act_id,
  ...extra,
});

const addRange = (body) =>
  api().post("/api/v1/carddetails").set("x-auth-token", submitter.token).send(body);

const updateRange = (id, body) =>
  api().put(`/api/v1/carddetails/${id}`).set("x-auth-token", submitter.token).send(body);

describe("ranges of a batch never overlap", () => {
  it("refuses an exact duplicate, a partial overlap and a range inside another", async () => {
    const first = await newActivation();
    const second = await newActivation();
    await addRange(range(first, "1000", "1999")).expect(200);

    for (const [start, end] of [
      ["1000", "1999"], // same range
      ["1500", "2500"], // overlaps the end
      ["0500", "1000"], // touches the first serial
      ["1200", "1300"], // inside
      ["0001", "9999"], // contains it
    ]) {
      const res = await addRange(range(second, start, end));
      expect(res.status, `${start}-${end}`).toBe(409);
    }
  });

  it("says which range and activation are in the way", async () => {
    const first = await newActivation();
    const second = await newActivation();
    await addRange(range(first, "1000", "1999")).expect(200);
    const { actno } = await db.Activations.findByPk(first);

    const res = await addRange(range(second, "1500", "2500"));
    expect(res.body.error).toBe(
      `Serial numbers 1500 to 2500 of batch ${batch} overlap the range ` +
        `1000 to 1999 of activation ${actno}`,
    );
  });

  it("also refuses an overlap inside the same activation", async () => {
    const id = await newActivation();
    await addRange(range(id, "1000", "1999")).expect(200);
    expect((await addRange(range(id, "1999", "2999"))).status).toBe(409);
  });

  it("accepts ranges next to each other, and the same serials in another batch", async () => {
    const id = await newActivation();
    await addRange(range(id, "1000", "1999")).expect(200);
    await addRange(range(id, "2000", "2999")).expect(200);
    await addRange(range(id, "0999", "0999")).expect(200);
    await addRange(range(id, "1000", "1999", { batch: `${batch}b` })).expect(200);
  });

  it("compares serial numbers as numbers, not as text", async () => {
    const id = await newActivation();
    await addRange(range(id, "99", "100")).expect(200);
    // As text "0100" < "99", but as numbers 100 is inside 99..100.
    expect((await addRange(range(id, "0100", "0200"))).status).toBe(409);
    // Long serial numbers, beyond JavaScript's safe integers.
    await addRange(range(id, "900000000000000000001", "900000000000000000100")).expect(200);
    expect(
      (await addRange(range(id, "900000000000000000100", "900000000000000000200"))).status,
    ).toBe(409);
  });

  it("an update cannot create an overlap, but a range does not block itself", async () => {
    const id = await newActivation();
    await addRange(range(id, "1000", "1999")).expect(200);
    await addRange(range(id, "3000", "3999")).expect(200);
    const [a, b] = await db.Cardsdetails.findAll({ where: { batch }, order: [["id", "ASC"]] });

    expect((await updateRange(b.id, range(id, "1500", "3999"))).status).toBe(409);
    expect((await updateRange(b.id, range(id, "3000", "3500", { cards: 5 }))).status).toBe(200);
    expect((await updateRange(a.id, range(id, "1000", "1999", { pins: 20 }))).status).toBe(200);
  });

  it("a deleted range frees its serial numbers", async () => {
    const id = await newActivation();
    await addRange(range(id, "1000", "1999")).expect(200);
    const [card] = await db.Cardsdetails.findAll({ where: { batch } });
    await api().delete(`/api/v1/carddetails/${card.id}`).set("x-auth-token", submitter.token).expect(204);
    await addRange(range(id, "1000", "1999")).expect(200);
  });

  it("two overlapping ranges sent at the same time: only one is saved", async () => {
    const first = await newActivation();
    const second = await newActivation();
    const results = await Promise.all([
      addRange(range(first, "1000", "1999")),
      addRange(range(second, "1500", "2500")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await db.Cardsdetails.count({ where: { batch } })).toBe(1);
  });
});

describe("serial number rules", () => {
  it("refuses serial numbers that are not digits", async () => {
    const id = await newActivation();
    const res = await addRange(range(id, "SN1000", "SN1999"));
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/digits only/);
  });

  it("refuses a start greater than the end", async () => {
    const id = await newActivation();
    const res = await addRange(range(id, "2000", "1000"));
    expect(res.status).toBe(400);
    expect(res.text).toMatch(/must not be greater/);
  });
});

describe("overlaps already in the database", () => {
  const send = (id) =>
    api().put(`/api/v1/activations/submit/${id}`).set("x-auth-token", submitter.token);
  const approve = (who, id) =>
    api().put(`/api/v1/activations/approve/${id}`).set("x-auth-token", who.token);

  it("block sending a draft until the range is corrected", async () => {
    const older = await newActivation();
    const draft = await newActivation();
    await addRange(range(older, "1000", "1999")).expect(200);
    // Saved directly, as old data could be, bypassing the API check.
    await db.Cardsdetails.create({ ...range(draft, "1500", "2500"), status: false });

    const res = await send(draft);
    expect(res.status).toBe(409);
    expect(res.text).toMatch(/overlap the range 1000 to 1999.*Correct the range/);
    expect((await db.Activations.findByPk(draft)).state).toBe("draft");

    const [bad] = await db.Cardsdetails.findAll({ where: { act_id: draft } });
    await updateRange(bad.id, range(draft, "2000", "2500")).expect(200);
    await send(draft).expect(200);
  });

  it("block the approval; level 2 rejects and the submitter corrects", async () => {
    const older = await newActivation();
    const newer = await newActivation();
    await addRange(range(older, "1000", "1999")).expect(200);
    await addRange(range(newer, "5000", "5999")).expect(200);
    await send(newer).expect(200);
    // Old data: an overlapping range already inside a sent activation.
    await db.Cardsdetails.create({ ...range(newer, "1500", "2500"), status: false });

    const res = await approve(accountant, newer);
    expect(res.status).toBe(409);
    expect(res.text).toMatch(/overlap the range 1000 to 1999.*Reject the activation/);
    expect((await db.Activations.findByPk(newer)).state).toBe("pending_level2");

    await api()
      .put(`/api/v1/activations/reject/${newer}`)
      .set("x-auth-token", accountant.token)
      .send({ reason: "Range 1500-2500 overlaps another activation" })
      .expect(200);
    const bad = await db.Cardsdetails.findOne({
      where: { act_id: newer, start_serialnumber: "1500" },
    });
    await updateRange(bad.id, range(newer, "2000", "2500")).expect(200);
    await api()
      .put(`/api/v1/activations/resubmit/${newer}`)
      .set("x-auth-token", submitter.token)
      .expect(200);
    await approve(accountant, newer).expect(200);
    await approve(billing, newer).expect(200);
  });
});
