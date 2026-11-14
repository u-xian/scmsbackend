import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { api, db, PROFILES, TEST_PREFIX, tokenForUser, createUser, cleanUp } =
  require("./helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

// Body accepted by PUT /user/:userId, built from the current record.
const editBody = (user, changes = {}) => ({
  name: user.name,
  username: user.username,
  phone: "0780000000",
  email: user.email,
  occupation: "Clerk",
  location: "Kigali",
  profil_id: user.profil_id,
  ...changes,
});

const updateUser = (token, user, changes) =>
  api().put(`/api/v1/user/${user.id}`).set("x-auth-token", token).send(editBody(user, changes));

describe("a user cannot make themselves admin", () => {
  it("refuses a non-admin changing their own profile", async () => {
    const { user } = await createUser({ profil_id: PROFILES.WAREHOUSE });
    const res = await updateUser(tokenForUser(user), user, { profil_id: PROFILES.ADMIN });
    expect(res.status).toBe(403);
    expect((await db.Users.findByPk(user.id)).profil_id).toBe(PROFILES.WAREHOUSE);
  });

  it("lets a non-admin edit their own details", async () => {
    const { user } = await createUser({ profil_id: PROFILES.BILLING });
    const res = await updateUser(tokenForUser(user), user, { name: "Renamed Self" });
    expect(res.status).toBe(200);
    expect((await db.Users.findByPk(user.id)).name).toBe("Renamed Self");
  });

  it("refuses a non-admin editing another user", async () => {
    const { user: me } = await createUser({ profil_id: PROFILES.BILLING });
    const { user: other } = await createUser({ profil_id: PROFILES.WAREHOUSE });
    const res = await updateUser(tokenForUser(me), other, { name: "Hacked" });
    expect(res.status).toBe(403);
  });

  it("lets an admin change a profile", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const { user } = await createUser({ profil_id: PROFILES.WAREHOUSE });
    const res = await updateUser(tokenForUser(admin), user, { profil_id: PROFILES.ACCOUNTING });
    expect(res.status).toBe(200);
    expect((await db.Users.findByPk(user.id)).profil_id).toBe(PROFILES.ACCOUNTING);
  });

  it("refuses a username already used by someone else", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const { user } = await createUser();
    const res = await updateUser(tokenForUser(user), user, { username: admin.username });
    expect(res.status).toBe(409);
  });

  it("only an admin can enable, disable or delete users", async () => {
    const { user: me } = await createUser({ profil_id: PROFILES.ACCOUNTING });
    const { user: other } = await createUser();
    const token = tokenForUser(me);

    const disable = await api()
      .put(`/api/v1/user/updatestatus/${other.id}`)
      .set("x-auth-token", token)
      .send({ status: false });
    expect(disable.status).toBe(403);

    const remove = await api().delete(`/api/v1/user/${other.id}`).set("x-auth-token", token);
    expect(remove.status).toBe(403);
    expect(await db.Users.findByPk(other.id)).not.toBeNull();
  });

  it("an admin cannot disable or delete their own account", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const token = tokenForUser(admin);
    const disable = await api()
      .put(`/api/v1/user/updatestatus/${admin.id}`)
      .set("x-auth-token", token)
      .send({ status: false });
    expect(disable.status).toBe(409);
    const remove = await api().delete(`/api/v1/user/${admin.id}`).set("x-auth-token", token);
    expect(remove.status).toBe(409);
  });

  it("updatestatus needs a true/false status", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const { user } = await createUser();
    const res = await api()
      .put(`/api/v1/user/updatestatus/${user.id}`)
      .set("x-auth-token", tokenForUser(admin))
      .send({});
    expect(res.status).toBe(400);
  });
});

describe("account changes apply to tokens already given", () => {
  it("a disabled user's token stops working immediately", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const { user } = await createUser();
    const token = tokenForUser(user);

    await api().get("/api/v1/dealers").set("x-auth-token", token).expect(200);

    await api()
      .put(`/api/v1/user/updatestatus/${user.id}`)
      .set("x-auth-token", tokenForUser(admin))
      .send({ status: false })
      .expect(200);

    const res = await api().get("/api/v1/dealers").set("x-auth-token", token);
    expect(res.status).toBe(401);
  });

  it("a deleted user's token stops working", async () => {
    const { user } = await createUser();
    const token = tokenForUser(user);
    await user.destroy();
    const res = await api().get("/api/v1/dealers").set("x-auth-token", token);
    expect(res.status).toBe(401);
  });

  it("an admin who loses the admin profile loses admin rights at once", async () => {
    const { user: admin } = await createUser({ profil_id: PROFILES.ADMIN });
    const token = tokenForUser(admin); // says profileId 1
    await admin.update({ profil_id: PROFILES.WAREHOUSE });

    const res = await api()
      .post("/api/v1/user")
      .set("x-auth-token", token)
      .send({
        name: "Someone",
        username: `${TEST_PREFIX}viaoldtoken`,
        phone: "0780000000",
        email: "s@example.com",
        occupation: "Clerk",
        location: "Kigali",
        profil_id: PROFILES.ADMIN,
      });
    expect(res.status).toBe(403);
  });
});

describe("a password change ends every session", () => {
  const login = (username, password) => api().post("/api/v1/auth").send({ username, password });
  const changePassword = (user, oldpassword, newpassword) =>
    api()
      .put(`/api/v1/auth/${user.id}`)
      .send({ oldpassword, newpassword, confirmpassword: newpassword });

  it("tokens given before the change stop working; a new login works", async () => {
    const { user, password } = await createUser();
    const first = (await login(user.username, password)).body.statusMessage;
    const second = (await login(user.username, password)).body.statusMessage;
    await api().get("/api/v1/dealers").set("x-auth-token", first).expect(200);

    await changePassword(user, password, "BrandNew123").expect(200);

    for (const oldToken of [first, second]) {
      const res = await api().get("/api/v1/dealers").set("x-auth-token", oldToken);
      expect(res.status).toBe(401);
      expect(res.text).toMatch(/password was changed/);
    }

    const fresh = (await login(user.username, "BrandNew123")).body.statusMessage;
    await api().get("/api/v1/dealers").set("x-auth-token", fresh).expect(200);
  });

  it("each change ends the tokens of the previous password", async () => {
    const { user, password } = await createUser();
    await changePassword(user, password, "Second123").expect(200);
    const token = (await login(user.username, "Second123")).body.statusMessage;
    await changePassword(user, "Second123", "Third1234").expect(200);
    expect((await api().get("/api/v1/dealers").set("x-auth-token", token)).status).toBe(401);
    expect((await db.Users.scope("withPassword").findByPk(user.id)).token_version).toBe(2);
  });

  it("a failed change does not end the sessions", async () => {
    const { user, password } = await createUser();
    const token = (await login(user.username, password)).body.statusMessage;
    await changePassword(user, "WrongOld123", "BrandNew123").expect(401);
    await api().get("/api/v1/dealers").set("x-auth-token", token).expect(200);
  });

  it("tokens made before token_version existed still work until a change", async () => {
    const { user } = await createUser();
    const { tv, ...withoutVersion } = { userid: user.id, profileId: user.profil_id, tv: 0 };
    const generateAuthToken = require("../server/services/generateAuthenticationToken");
    const legacy = generateAuthToken(withoutVersion);
    await api().get("/api/v1/dealers").set("x-auth-token", legacy).expect(200);
  });

  it("a disabled then enabled user does not get the old sessions back", async () => {
    const { user: adminUser } = await createUser({ profil_id: PROFILES.ADMIN });
    const { user, password } = await createUser();
    const token = (await login(user.username, password)).body.statusMessage;
    const setStatus = (status) =>
      api()
        .put(`/api/v1/user/updatestatus/${user.id}`)
        .set("x-auth-token", tokenForUser(adminUser))
        .send({ status });

    await setStatus(false).expect(200);
    await setStatus(true).expect(200);
    expect((await api().get("/api/v1/dealers").set("x-auth-token", token)).status).toBe(401);
    const fresh = (await login(user.username, password)).body.statusMessage;
    await api().get("/api/v1/dealers").set("x-auth-token", fresh).expect(200);
  });
});
