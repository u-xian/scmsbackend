/*
  Dealers, denominations, mail receivers and profiles share the same API:
    GET    /<path>                     list
    GET    /<path>/:id                 get one
    POST   /<path>                     create (status true)
    PUT    /<path>/:id                 update (full body)
    PUT    /<path>/updatestatus/:id    enable or disable ({ status })
    DELETE /<path>/:id                 delete
  The same tests run for each of them.

  Tests marked it.fails describe the expected behaviour of a known bug: they
  pass while the bug is there. When the bug is fixed, vitest reports them as
  failing: then change it.fails into it.
*/
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { db, PROFILES, loginAs, uniqueName, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

const RESOURCES = [
  {
    name: "dealers",
    path: "/dealers",
    model: () => db.Dealers,
    nameField: "dealername",
    entity: "Dealer",
    valid: (name) => ({ dealername: name }),
    invalid: [
      [{}, '"dealername" is required'],
      [{ dealername: "x" }, '"dealername" length must be at least 2 characters long'],
      [{ dealername: "Good name", extra: 1 }, '"extra" is not allowed'],
    ],
  },
  {
    name: "denominations",
    path: "/denomination",
    model: () => db.Denominations,
    nameField: "label",
    entity: "Denomination",
    valid: (name) => ({ label: name, pinspercard: 1, pinsvalue: 500 }),
    invalid: [
      [{}, '"label" is required'],
      [{ label: "500 RWF", pinspercard: 1 }, '"pinsvalue" is required'],
      [{ label: "500 RWF", pinspercard: "one", pinsvalue: 500 }, '"pinspercard" must be a number'],
      [{ label: "500 RWF", pinspercard: 1.5, pinsvalue: 500 }, '"pinspercard" must be an integer'],
    ],
  },
  {
    name: "mail receivers",
    path: "/mailreceivers",
    model: () => db.Mailreceivers,
    nameField: "names",
    entity: "Mailreceiver",
    valid: (name) => ({ names: name, email: "receiver@example.com" }),
    invalid: [
      [{}, '"names" is required'],
      [{ names: "Jean Claude" }, '"email" is required'],
    ],
  },
  {
    name: "profiles",
    path: "/profiles",
    model: () => db.Profiles,
    nameField: "profilename",
    entity: "Profile",
    valid: (name) => ({ profilename: name }),
    invalid: [
      [{}, '"profilename" is required'],
      [{ profilename: "a".repeat(51) }, '"profilename" length must be less than or equal to 50 characters long'],
    ],
  },
];

describe.each(RESOURCES)("$name API", (resource) => {
  let admin;
  beforeEach(async () => {
    admin = await loginAs(PROFILES.ADMIN);
  });

  // Creates a record through the API and returns it from the database.
  async function create(name = uniqueName(resource.name.slice(0, 4))) {
    const res = await admin.post(resource.path).send(resource.valid(name));
    expect(res.status).toBe(200);
    return resource.model().findOne({ where: { [resource.nameField]: name } });
  }

  it(`POST ${resource.path} creates an enabled record`, async () => {
    const name = uniqueName();
    const res = await admin.post(resource.path).send(resource.valid(name));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { status: 1, statusMessage: `${resource.entity} created!` },
    });
    const record = await resource.model().findOne({ where: { [resource.nameField]: name } });
    expect(record).not.toBeNull();
    expect(record.status).toBe(true);
  });

  it.each(resource.invalid)(`POST ${resource.path} refuses %j`, async (body, message) => {
    const res = await admin.post(resource.path).send(body);
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it(`GET ${resource.path} lists the records`, async () => {
    const record = await create();
    const res = await admin.get(resource.path);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((r) => r.id === record.id);
    expect(found[resource.nameField]).toBe(record[resource.nameField]);
  });

  it(`GET ${resource.path}/:id returns one record`, async () => {
    const record = await create();
    const res = await admin.get(`${resource.path}/${record.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      id: record.id,
      [resource.nameField]: record[resource.nameField],
      status: true,
    });
  });

  it(`GET ${resource.path}/:id answers 404 for an unknown id and 400 for a bad id`, async () => {
    expect((await admin.get(`${resource.path}/99999999`)).status).toBe(404);
    expect((await admin.get(`${resource.path}/abc`)).status).toBe(400);
  });

  it(`PUT ${resource.path}/:id updates the record`, async () => {
    const record = await create();
    const newName = uniqueName("upd");
    const res = await admin.put(`${resource.path}/${record.id}`).send(resource.valid(newName));
    expect(res.status).toBe(200);
    expect(res.body.data.statusMessage).toBe(`${resource.entity} updated!`);
    await record.reload();
    expect(record[resource.nameField]).toBe(newName);
  });

  it(`PUT ${resource.path}/:id validates the body and answers 404 for an unknown id`, async () => {
    const record = await create();
    const [invalidBody, message] = resource.invalid[0];
    const bad = await admin.put(`${resource.path}/${record.id}`).send(invalidBody);
    expect(bad.status).toBe(400);
    expect(bad.text).toBe(message);

    const missing = await admin.put(`${resource.path}/99999999`).send(resource.valid(uniqueName()));
    expect(missing.status).toBe(404);
  });

  it(`PUT ${resource.path}/updatestatus/:id disables and enables`, async () => {
    const record = await create();
    const off = await admin.put(`${resource.path}/updatestatus/${record.id}`).send({ status: false });
    expect(off.status).toBe(200);
    await record.reload();
    expect(record.status).toBe(false);

    await admin.put(`${resource.path}/updatestatus/${record.id}`).send({ status: true }).expect(200);
    await record.reload();
    expect(record.status).toBe(true);

    const missing = await admin.put(`${resource.path}/updatestatus/99999999`).send({ status: true });
    expect(missing.status).toBe(404);
  });

  it(`PUT ${resource.path}/updatestatus/:id refuses an invalid status`, async () => {
    const record = await create();
    const res = await admin.put(`${resource.path}/updatestatus/${record.id}`).send({ status: "maybe" });
    expect(res.status).toBe(400);
    await record.reload();
    expect(record.status).toBe(true);
  });

  // BUG: without "status" the answer is 200 "updated!" although nothing changed.
  it.fails(`BUG: PUT ${resource.path}/updatestatus/:id accepts a missing status`, async () => {
    const record = await create();
    const res = await admin.put(`${resource.path}/updatestatus/${record.id}`).send({});
    expect(res.status).toBe(400);
  });

  it(`DELETE ${resource.path}/:id deletes the record`, async () => {
    const record = await create();
    const res = await admin.delete(`${resource.path}/${record.id}`);
    expect(res.status).toBe(204);
    expect(await resource.model().findByPk(record.id)).toBeNull();
    expect((await admin.delete(`${resource.path}/${record.id}`)).status).toBe(404);
  });

  // BUG: the API does not check the profile; only the menu is admin only
  // (menuaccessData.json). A warehouse user can even delete the admin profile.
  it.fails(`BUG: any logged-in user can create, change or delete ${resource.name}`, async () => {
    const record = await create();
    const warehouse = await loginAs(PROFILES.WAREHOUSE);
    const attempts = [
      await warehouse.post(resource.path).send(resource.valid(uniqueName())),
      await warehouse.put(`${resource.path}/${record.id}`).send(resource.valid(uniqueName())),
      await warehouse.put(`${resource.path}/updatestatus/${record.id}`).send({ status: false }),
      await warehouse.delete(`${resource.path}/${record.id}`),
    ];
    expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403]);
  });

  it(`any logged-in user can read ${resource.name}`, async () => {
    const record = await create();
    const billing = await loginAs(PROFILES.BILLING);
    expect((await billing.get(resource.path)).status).toBe(200);
    expect((await billing.get(`${resource.path}/${record.id}`)).status).toBe(200);
  });
});
