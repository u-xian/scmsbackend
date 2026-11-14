import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const { api, db, PROFILES, tokenFor, createUser, cleanUp } = require("./helpers/testApp");

const newUserBody = (username) => ({
  name: "New User",
  username,
  phone: "0780000000",
  email: "new@example.com",
  occupation: "Clerk",
  location: "Kigali",
  profil_id: PROFILES.ADMIN,
});

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

describe("the signing key is required", () => {
  const savedKey = process.env.jwtPrivateKey;
  afterEach(() => {
    process.env.jwtPrivateKey = savedKey;
  });

  it("refuses protected requests when jwtPrivateKey is missing", async () => {
    delete process.env.jwtPrivateKey;
    const res = await api().get("/api/v1/user");
    expect(res.status).toBe(500);
  });

  it("refuses a token signed with alg none", async () => {
    const unsigned = jwt.sign({ userid: 1, profileId: PROFILES.ADMIN }, null, {
      algorithm: "none",
    });
    const res = await api().get("/api/v1/user").set("x-auth-token", unsigned);
    expect(res.status).toBe(400);
  });

  it("the server does not start without jwtPrivateKey", () => {
    const run = spawnSync(process.execPath, [path.join(__dirname, "../bin/run.js")], {
      env: { ...process.env, jwtPrivateKey: "" },
      timeout: 10000,
    });
    expect(run.status).toBe(1);
    expect(run.stderr.toString()).toContain("jwtPrivateKey is not set");
  });
});

describe("POST /user is reserved to admins", () => {
  it("refuses a request without a token", async () => {
    const res = await api().post("/api/v1/user").send(newUserBody("zztest_anon"));
    expect(res.status).toBe(401);
    expect(await db.Users.findOne({ where: { username: "zztest_anon" } })).toBeNull();
  });

  it("refuses a user who is not an admin", async () => {
    const res = await api()
      .post("/api/v1/user")
      .set("x-auth-token", await tokenFor(PROFILES.WAREHOUSE))
      .send(newUserBody("zztest_warehouse"));
    expect(res.status).toBe(403);
    expect(await db.Users.findOne({ where: { username: "zztest_warehouse" } })).toBeNull();
  });

  it("lets an admin create a user", async () => {
    const res = await api()
      .post("/api/v1/user")
      .set("x-auth-token", await tokenFor(PROFILES.ADMIN))
      .send(newUserBody("zztest_byadmin"));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe(1);
  });
});

describe("the password hash is never returned", () => {
  it("GET /user/:userId has no password", async () => {
    const { user } = await createUser();
    const res = await api().get(`/api/v1/user/${user.id}`).set("x-auth-token", await tokenFor(PROFILES.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe(user.username);
    expect(res.body.data).not.toHaveProperty("password");
  });

  it("GET /user has no password", async () => {
    await createUser();
    const res = await api().get("/api/v1/user").set("x-auth-token", await tokenFor(PROFILES.ADMIN));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const user of res.body.data) expect(user).not.toHaveProperty("password");
  });
});

describe("login", () => {
  const login = (username, password) => api().post("/api/v1/auth").send({ username, password });

  it("works for an active user", async () => {
    const { user, password } = await createUser();
    const res = await login(user.username, password);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(1);
  });

  it("refuses a disabled user", async () => {
    const { user, password } = await createUser({ status: false });
    const res = await login(user.username, password);
    expect(res.status).toBe(403);
    expect(res.body.status).toBe(0);
  });

  it("treats a user without expired_at as expired instead of crashing", async () => {
    const { user, password } = await createUser({ expired_at: null });
    const res = await login(user.username, password);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 3, userId: user.id });
  });

  it("refuses a user without a stored password instead of crashing", async () => {
    const { user } = await createUser({ password: null });
    const res = await login(user.username, "Whatever1");
    expect(res.status).toBe(401);
  });
});

describe("password change (PUT /auth/:userId)", () => {
  const change = (userId, body) => api().put(`/api/v1/auth/${userId}`).send(body);

  it("takes a new user from first login to a working login, without a token", async () => {
    await api()
      .post("/api/v1/user")
      .set("x-auth-token", await tokenFor(PROFILES.ADMIN))
      .send({ ...newUserBody("zztest_firstlogin"), profil_id: PROFILES.BILLING })
      .expect(200);

    const first = await api()
      .post("/api/v1/auth")
      .send({ username: "zztest_firstlogin", password: process.env.defaultPassword });
    expect(first.body.status).toBe(2);

    const res = await change(first.body.userId, {
      resetType: 2,
      oldpassword: process.env.defaultPassword,
      newpassword: "MyNewPass1",
      confirmpassword: "MyNewPass1",
    });
    expect(res.status).toBe(200);

    const second = await api()
      .post("/api/v1/auth")
      .send({ username: "zztest_firstlogin", password: "MyNewPass1" });
    expect(second.body.status).toBe(1);
  });

  it("renews an expired password", async () => {
    const { user, password } = await createUser({ expired_at: new Date(Date.now() - 1000) });
    await change(user.id, {
      resetType: 3,
      oldpassword: password,
      newpassword: "Renewed123",
      confirmpassword: "Renewed123",
    }).expect(200);

    const reloaded = await db.Users.findByPk(user.id);
    expect(reloaded.expired_at.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses a wrong old password", async () => {
    const { user } = await createUser();
    const res = await change(user.id, {
      oldpassword: "NotMyPassword",
      newpassword: "Another123",
      confirmpassword: "Another123",
    });
    expect(res.status).toBe(401);
  });

  it("refuses a missing confirmpassword (used to crash the server)", async () => {
    const { user, password } = await createUser();
    const res = await change(user.id, { oldpassword: password, newpassword: "Another123" });
    expect(res.status).toBe(400);
  });

  it("refuses an empty body", async () => {
    const { user } = await createUser();
    const res = await change(user.id, {});
    expect(res.status).toBe(400);
  });

  it("refuses a confirmpassword that does not match", async () => {
    const { user, password } = await createUser();
    const res = await change(user.id, {
      oldpassword: password,
      newpassword: "Another123",
      confirmpassword: "Different123",
    });
    expect(res.status).toBe(400);
    expect(res.text).toBe("The passwords do not match");
  });

  it("refuses a new password equal to the old one", async () => {
    const { user, password } = await createUser();
    const res = await change(user.id, {
      oldpassword: password,
      newpassword: password,
      confirmpassword: password,
    });
    expect(res.status).toBe(400);
  });

  it("refuses a disabled user", async () => {
    const { user, password } = await createUser({ status: false });
    const res = await change(user.id, {
      oldpassword: password,
      newpassword: "Another123",
      confirmpassword: "Another123",
    });
    expect(res.status).toBe(403);
  });

  it("answers 404 for an unknown user and 400 for an id that is not a number", async () => {
    const body = { oldpassword: "x", newpassword: "Another123", confirmpassword: "Another123" };
    expect((await change(99999999, body)).status).toBe(404);
    expect((await change("abc", body)).status).toBe(400);
  });
});
