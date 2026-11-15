/*
  Login and tokens: normal use. Security rules (disabled users, password
  change, first login, ...) are in tests/authSecurity.test.js and
  tests/userPermissions.test.js.
*/
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const { api, db, PROFILES, createUser, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

const login = (body) => api().post("/api/v1/auth").send(body);

describe("POST /auth (login)", () => {
  it.each([
    [{}, '"username" is required'],
    [{ username: "someone" }, '"password" is required'],
    [{ username: "abc", password: "Secret123" }, '"username" length must be at least 5 characters long'],
    [{ username: "someone", password: "abc" }, '"password" length must be at least 5 characters long'],
  ])("refuses %j", async (body, message) => {
    const res = await login(body);
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it("answers 401 with status 0 for an unknown username or a wrong password", async () => {
    const { user } = await createUser();
    const unknown = await login({ username: "zztest_nobody", password: "Secret123" });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual({ status: 0, statusMessage: "Invalid username!" });

    const wrong = await login({ username: user.username, password: "WrongPass1" });
    expect(wrong.status).toBe(401);
    expect(wrong.body).toEqual({ status: 0, statusMessage: "Invalid password!" });
  });

  it("gives a token valid 1 hour, holding the user, the menus and the default menu", async () => {
    const { user, password } = await createUser({ profil_id: PROFILES.ADMIN });
    const res = await login({ username: user.username, password });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(1);

    const token = jwt.verify(res.body.statusMessage, process.env.jwtPrivateKey);
    expect(token).toMatchObject({
      userid: user.id,
      profileId: PROFILES.ADMIN,
      username: user.username,
      first_login_flag: false,
      tv: 0,
      resetType: 4,
      userdefaultmenu: { pathname: "home" },
    });
    expect(token.exp - token.iat).toBe(3600);
    const menus = token.usermenus.map((m) => m.pathname);
    expect(menus).toEqual(expect.arrayContaining(["home", "activations", "dealers", "profiles"]));
    expect(Object.keys(token.usermenus[0]).sort()).toEqual(["description", "id", "menuicon", "pathname"]);
  });

  it("gives each profile only its own menus", async () => {
    const { user, password } = await createUser({ profil_id: PROFILES.BILLING });
    const res = await login({ username: user.username, password });
    const { usermenus } = jwt.decode(res.body.statusMessage);
    const menus = usermenus.map((m) => m.pathname);
    expect(menus).toEqual(expect.arrayContaining(["home", "activations", "carddetails"]));
    expect(menus).not.toContain("dealers");
  });

  it("the token opens the protected routes", async () => {
    const { user, password } = await createUser();
    const token = (await login({ username: user.username, password })).body.statusMessage;
    const res = await api().get("/api/v1/dealers").set("x-auth-token", token);
    expect(res.status).toBe(200);
  });

  it("an expired token answers 403 Token expired", async () => {
    const { user } = await createUser();
    const expired = jwt.sign(
      { userid: user.id, profileId: user.profil_id, tv: 0, exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.jwtPrivateKey,
    );
    const res = await api().get("/api/v1/dealers").set("x-auth-token", expired);
    expect(res.status).toBe(403);
    expect(res.text).toBe("Token expired");
  });

  it("a token signed with another key answers 400", async () => {
    const { user } = await createUser();
    const forged = jwt.sign({ userid: user.id, profileId: PROFILES.ADMIN, tv: 0 }, "another-key");
    const res = await api().get("/api/v1/dealers").set("x-auth-token", forged);
    expect(res.status).toBe(400);
  });
});
