/*
  Users API: normal use. Permission rules (who may change what) are in
  tests/userPermissions.test.js.
*/
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const bcrypt = require("bcrypt");
const { db, PROFILES, loginAs, uniqueName, createUser, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

let admin;
beforeEach(async () => {
  admin = await loginAs(PROFILES.ADMIN);
});

const userBody = (overrides = {}) => ({
  name: "Grace Mukamana",
  username: uniqueName("u"),
  phone: "0788000000",
  email: "grace@example.com",
  occupation: "Accountant",
  location: "Kigali",
  profil_id: PROFILES.ACCOUNTING,
  ...overrides,
});

describe("users API", () => {
  it("POST /user creates a user who must change the default password", async () => {
    const body = userBody();
    const res = await admin.post("/user").send(body);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 1, statusMessage: "User created!" } });

    const user = await db.Users.scope("withPassword").findOne({ where: { username: body.username } });
    expect(user).toMatchObject({ ...body, status: true, first_login_flag: true });
    expect(await bcrypt.compare(process.env.defaultPassword, user.password)).toBe(true);
    const days = (user.expired_at - Date.now()) / 86400000;
    expect(days).toBeGreaterThan(29);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("POST /user answers status 0 for a username already registered", async () => {
    const body = userBody();
    await admin.post("/user").send(body).expect(200);
    const res = await admin.post("/user").send({ ...body, name: "Someone Else" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 0, statusMessage: "User already registered." } });
    expect(await db.Users.count({ where: { username: body.username } })).toBe(1);
  });

  it.each([
    [{ name: undefined }, '"name" is required'],
    [{ username: "a" }, '"username" length must be at least 2 characters long'],
    [{ profil_id: "admin" }, '"profil_id" must be a number'],
    [{ password: "ChosenByMe1" }, '"password" is not allowed'],
  ])("POST /user refuses %j", async (overrides, message) => {
    const res = await admin.post("/user").send(userBody(overrides));
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ data: message });
  });

  it("GET /user lists users with their profile, newest first, without passwords", async () => {
    const { user: older } = await createUser();
    const { user: newer } = await createUser();
    const res = await admin.get("/user");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u) => u.id);
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id));
    const found = res.body.data.find((u) => u.id === older.id);
    expect(found.profiles).toMatchObject({ id: PROFILES.WAREHOUSE, profilename: "warehouse" });
    expect(found).not.toHaveProperty("password");
    expect(found).not.toHaveProperty("token_version");
  });

  it("GET /user/:id returns one user; 404 unknown; 400 bad id", async () => {
    const { user } = await createUser({ name: "Eric Habimana" });
    const res = await admin.get(`/user/${user.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: user.id, name: "Eric Habimana" });
    expect((await admin.get("/user/99999999")).status).toBe(404);
    expect((await admin.get("/user/abc")).status).toBe(400);
  });

  it("PUT /user/:id updates a user; validates; 404 when unknown", async () => {
    const { user } = await createUser();
    const body = userBody({ username: user.username, name: "New Name", location: "Huye" });
    await admin.put(`/user/${user.id}`).send(body).expect(200);
    await user.reload();
    expect(user).toMatchObject({ name: "New Name", location: "Huye", profil_id: PROFILES.ACCOUNTING });

    expect((await admin.put(`/user/${user.id}`).send({ name: "Only name" })).status).toBe(400);
    expect((await admin.put("/user/99999999").send(userBody())).status).toBe(404);
  });

  it("PUT /user/updatestatus/:id disables and enables; 404 when unknown", async () => {
    const { user } = await createUser();
    await admin.put(`/user/updatestatus/${user.id}`).send({ status: false }).expect(200);
    await user.reload();
    expect(user.status).toBe(false);
    await admin.put(`/user/updatestatus/${user.id}`).send({ status: true }).expect(200);
    await user.reload();
    expect(user.status).toBe(true);
    expect((await admin.put("/user/updatestatus/99999999").send({ status: true })).status).toBe(404);
  });

  it("DELETE /user/:id deletes a user; 404 when unknown", async () => {
    const { user } = await createUser();
    expect((await admin.delete(`/user/${user.id}`)).status).toBe(204);
    expect(await db.Users.findByPk(user.id)).toBeNull();
    expect((await admin.delete(`/user/${user.id}`)).status).toBe(404);
  });
});
