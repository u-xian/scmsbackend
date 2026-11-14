import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { api, db, PROFILES, TEST_PREFIX, tokenForUser, createUser, cleanUp } =
  require("./helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

// One user per role, created again for every test.
let submitter, accountant, accountant2, billing, billing2, admin, warehouse;
beforeEach(async () => {
  const make = async (profil_id) => {
    const { user } = await createUser({ profil_id });
    return { user, token: tokenForUser(user) };
  };
  submitter = await make(PROFILES.ADMIN);
  admin = await make(PROFILES.ADMIN);
  accountant = await make(PROFILES.ACCOUNTING);
  accountant2 = await make(PROFILES.ACCOUNTING);
  billing = await make(PROFILES.BILLING);
  billing2 = await make(PROFILES.BILLING);
  warehouse = await make(PROFILES.WAREHOUSE);
});

let serial = 0;
const cardBody = (actId) => {
  serial += 1;
  return {
    batch: `${TEST_PREFIX}W${Date.now()}`,
    start_serialnumber: `${serial}000`,
    end_serialnumber: `${serial}999`,
    pins: 10,
    cards: 10,
    denom_id: 1,
    act_id: actId,
  };
};

const put = (who, path, body = {}) =>
  api().put(`/api/v1${path}`).set("x-auth-token", who.token).send(body);

const addCard = (who, actId) =>
  api().post("/api/v1/carddetails").set("x-auth-token", who.token).send(cardBody(actId));

const approve = (who, id) => put(who, `/activations/approve/${id}`);
const reject = (who, id, reason) =>
  put(who, `/activations/reject/${id}`, reason === undefined ? {} : { reason });
const resubmit = (who, id, body = {}) => put(who, `/activations/resubmit/${id}`, body);

// New activation with one card range, waiting for level 2.
async function newActivation(who = submitter, { withCard = true } = {}) {
  const res = await api()
    .post("/api/v1/activations")
    .set("x-auth-token", who.token)
    .send({ dealer_id: 1 });
  expect(res.status).toBe(200);
  const id = res.body.data.activId;
  if (withCard) expect((await addCard(who, id)).status).toBe(200);
  return id;
}

const reload = (id) => db.Activations.findByPk(id);
const cardsOf = (id) => db.Cardsdetails.findAll({ where: { act_id: id } });
const eventsOf = (id) =>
  db.ActivationEvents.findAll({ where: { act_id: id }, order: [["id", "ASC"]] });

describe("happy path", () => {
  it("goes submitted -> level 2 -> level 3 and activates the cards", async () => {
    const id = await newActivation();
    expect((await reload(id)).state).toBe("pending_level2");

    const l2 = await approve(accountant, id);
    expect(l2.status).toBe(200);
    expect(l2.body.data.state).toBe("pending_level3");
    for (const card of await cardsOf(id)) expect(card.status).toBe(false);

    const l3 = await approve(billing, id);
    expect(l3.status).toBe(200);
    expect(l3.body.data.state).toBe("approved");

    const activation = await reload(id);
    expect(activation.status).toBe(1);
    expect(activation.activated_at).toBeInstanceOf(Date);
    for (const card of await cardsOf(id)) {
      expect(card.status).toBe(true);
      expect(card.activated_at).toBeInstanceOf(Date);
    }

    const events = (await eventsOf(id)).map((e) => [e.level, e.action, e.userid]);
    expect(events).toEqual([
      [1, "submitted", submitter.user.id],
      [2, "approved", accountant.user.id],
      [3, "approved", billing.user.id],
    ]);
  });

  it("records the submitter from the token, not from the body", async () => {
    const res = await api()
      .post("/api/v1/activations")
      .set("x-auth-token", submitter.token)
      .send({ dealer_id: 1, userid: accountant.user.id });
    expect((await reload(res.body.data.activId)).userid).toBe(submitter.user.id);
  });
});

describe("levels go in order", () => {
  it("level 3 cannot act before level 2", async () => {
    const id = await newActivation();
    const res = await approve(billing, id);
    expect(res.status).toBe(409);
    expect(res.text).toMatch(/waiting for level 2/);
    expect((await reject(billing, id, "Not allowed yet")).status).toBe(409);
    expect((await reload(id)).state).toBe("pending_level2");
  });

  it("level 2 cannot act twice", async () => {
    const id = await newActivation();
    await approve(accountant, id).expect(200);
    expect((await approve(accountant2, id)).status).toBe(409);
    expect((await reject(accountant2, id, "Changed my mind")).status).toBe(409);
  });

  it("nothing changes an approved activation", async () => {
    const id = await newActivation();
    await approve(accountant, id).expect(200);
    await approve(billing, id).expect(200);
    const again = await approve(billing2, id);
    expect(again.status).toBe(409);
    expect(again.text).toMatch(/already approved/);
    expect((await reject(billing2, id, "Too late now")).status).toBe(409);
    expect((await resubmit(submitter, id)).status).toBe(409);
  });

  it("profiles without an approval level cannot decide", async () => {
    const id = await newActivation();
    expect((await approve(admin, id)).status).toBe(403);
    expect((await approve(warehouse, id)).status).toBe(403);
    expect((await reject(warehouse, id, "Not my job")).status).toBe(403);
  });

  it("nobody approves or rejects their own activation", async () => {
    const id = await newActivation(accountant);
    expect((await approve(accountant, id)).status).toBe(403);
    expect((await reject(accountant, id, "My own one")).status).toBe(403);
    expect((await approve(accountant2, id)).status).toBe(200);
  });

  it("an activation without card details cannot be approved", async () => {
    const id = await newActivation(submitter, { withCard: false });
    const res = await approve(accountant, id);
    expect(res.status).toBe(409);
    expect(res.text).toMatch(/without card details/);
  });

  it("lists only what each level has to decide", async () => {
    const waitingL2 = await newActivation();
    const waitingL3 = await newActivation();
    await approve(accountant, waitingL3).expect(200);
    const rejected = await newActivation();
    await reject(accountant, rejected, "Wrong dealer").expect(200);

    const ids = async (profileId) =>
      (
        await api()
          .get(`/api/v1/activations/activbyprofile/${profileId}`)
          .set("x-auth-token", admin.token)
      ).body.data.map((a) => a.id);

    const l2 = await ids(3);
    expect(l2).toContain(waitingL2);
    expect(l2).not.toContain(waitingL3);
    expect(l2).not.toContain(rejected);

    const l3 = await ids(4);
    expect(l3).toContain(waitingL3);
    expect(l3).not.toContain(waitingL2);
    expect(l3).not.toContain(rejected);

    expect(await ids(0)).toEqual(expect.arrayContaining([waitingL2, waitingL3, rejected]));
  });
});

describe("a rejection needs a reason", () => {
  it("refuses a missing, blank or too short reason", async () => {
    const id = await newActivation();
    expect((await reject(accountant, id)).status).toBe(400);
    expect((await reject(accountant, id, "    ")).status).toBe(400);
    expect((await reject(accountant, id, "no")).status).toBe(400);
    expect((await reload(id)).state).toBe("pending_level2");
  });

  it("stores the reason and shows it in the history", async () => {
    const id = await newActivation();
    await approve(accountant, id).expect(200);
    const res = await reject(billing, id, "  Serial numbers overlap batch 12  ");
    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe("rejected");

    const activation = await reload(id);
    expect(activation.status).toBe(2);
    expect(activation.confirmation_lvl3).toBe(2);

    const view = await api().get(`/api/v1/activations/${id}`).set("x-auth-token", submitter.token);
    const last = view.body.data.events.at(-1);
    expect(last).toMatchObject({
      level: 3,
      action: "rejected",
      reason: "Serial numbers overlap batch 12",
      user: { id: billing.user.id },
    });
  });
});

describe("a rejected activation can be sent again", () => {
  it("goes back to level 2 and can then be approved", async () => {
    const id = await newActivation();
    await approve(accountant, id).expect(200);
    await reject(billing, id, "Missing one batch").expect(200);

    // The submitter fixes the activation, then sends it again.
    expect((await addCard(submitter, id)).status).toBe(200);
    const res = await resubmit(submitter, id, { comment: "Batch added" });
    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe("pending_level2");
    expect((await reload(id)).status).toBe(0);

    await approve(accountant, id).expect(200);
    await approve(billing, id).expect(200);
    for (const card of await cardsOf(id)) expect(card.status).toBe(true);

    const actions = (await eventsOf(id)).map((e) => `${e.level}:${e.action}`);
    expect(actions).toEqual([
      "1:submitted",
      "2:approved",
      "3:rejected",
      "1:resubmitted",
      "2:approved",
      "3:approved",
    ]);
  });

  it("only the submitter or an admin can send it again", async () => {
    const id = await newActivation();
    await reject(accountant, id, "Wrong dealer").expect(200);
    expect((await resubmit(accountant2, id)).status).toBe(403);
    expect((await resubmit(admin, id)).status).toBe(200);
  });

  it("cannot send again an activation that is not rejected", async () => {
    const id = await newActivation();
    const res = await resubmit(submitter, id);
    expect(res.status).toBe(409);
  });
});

describe("an activation under review is locked", () => {
  it("refuses changes once level 2 has approved", async () => {
    const id = await newActivation();
    const [card] = await cardsOf(id);
    await approve(accountant, id).expect(200);

    expect((await addCard(submitter, id)).status).toBe(409);
    expect((await put(submitter, `/carddetails/${card.id}`, { ...cardBody(id), batch: card.batch })).status).toBe(409);
    expect((await api().delete(`/api/v1/carddetails/${card.id}`).set("x-auth-token", submitter.token)).status).toBe(409);
    expect((await api().delete(`/api/v1/carddetails/deletebyactivId/${id}`).set("x-auth-token", submitter.token)).status).toBe(409);
    expect((await put(submitter, `/activations/${id}`, { dealer_id: 2 })).status).toBe(409);
    expect((await api().delete(`/api/v1/activations/${id}`).set("x-auth-token", submitter.token)).status).toBe(409);
    expect(await cardsOf(id)).toHaveLength(1);
  });

  it("only the submitter or an admin can change it", async () => {
    const id = await newActivation();
    expect((await addCard(accountant, id)).status).toBe(403);
    expect((await put(accountant, `/activations/${id}`, { dealer_id: 2 })).status).toBe(403);
    expect((await addCard(admin, id)).status).toBe(200);
  });

  it("card details cannot move to another activation", async () => {
    const id = await newActivation();
    const other = await newActivation();
    const [card] = await cardsOf(id);
    const res = await put(submitter, `/carddetails/${card.id}`, { ...cardBody(other), batch: card.batch });
    expect(res.status).toBe(409);
  });

  it("the routes that skipped the workflow are gone", async () => {
    const id = await newActivation();
    const [card] = await cardsOf(id);
    for (const path of [
      `/activations/confirm/${id}`,
      `/activations/updatestatus/${id}`,
      `/carddetails/updatestatus/${id}`,
      `/carddetails/cardactivate/${card.id}`,
    ])
      expect((await put(admin, path, { status: 1, level: 4, confirmStatus: false })).status).toBe(404);
    for (const c of await cardsOf(id)) expect(c.status).toBe(false);
    expect((await reload(id)).state).toBe("pending_level2");
  });
});

describe("the final approval is one transaction", () => {
  it("saves nothing when a step fails", async () => {
    const id = await newActivation();
    await addCard(submitter, id).expect(200);
    await approve(accountant, id).expect(200);

    // The last step (history record) fails after cards and activation
    // were updated inside the transaction.
    const failure = vi
      .spyOn(db.ActivationEvents, "create")
      .mockRejectedValueOnce(new Error("disk full"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await approve(billing, id);
    expect(res.status).toBe(500);
    failure.mockRestore();
    log.mockRestore();

    const activation = await reload(id);
    expect(activation.state).toBe("pending_level3");
    expect(activation.status).toBe(0);
    expect(activation.activated_at).toBeNull();
    const cards = await cardsOf(id);
    expect(cards).toHaveLength(2);
    for (const card of cards) {
      expect(card.status).toBe(false);
      expect(card.activated_at).toBeNull();
    }

    // Nothing is left half done: it can still be approved normally.
    await approve(billing, id).expect(200);
    for (const card of await cardsOf(id)) expect(card.status).toBe(true);
  });

  it("two final approvals at the same time: one wins, the other is refused", async () => {
    const id = await newActivation();
    await approve(accountant, id).expect(200);

    const results = await Promise.all([approve(billing, id), approve(billing2, id)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const finals = (await eventsOf(id)).filter((e) => e.level === 3);
    expect(finals).toHaveLength(1);
  });

  it("an approval and a rejection at the same time: only one is applied", async () => {
    const id = await newActivation();
    const results = await Promise.all([
      approve(accountant, id),
      reject(accountant2, id, "Dealer is suspended"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await eventsOf(id)).filter((e) => e.level === 2)).toHaveLength(1);
  });
});
