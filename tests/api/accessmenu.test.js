import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { db, PROFILES, loginAs, uniqueName, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

let admin, level;
beforeEach(async () => {
  admin = await loginAs(PROFILES.ADMIN);
  // A profile level used by no real profile, so only the test menus match.
  level = 900 + Math.floor(Math.random() * 99000);
});

const menuBody = (overrides = {}) => ({
  pathname: uniqueName("menu"),
  description: "Test menu",
  accesslevel: [level],
  menuicon: "ni ni-tv-2 text-primary",
  defaultmenuitem: false,
  ...overrides,
});

async function createMenu(overrides) {
  const body = menuBody(overrides);
  await admin.post("/accessmenu").send(body).expect(200);
  return db.AccessMenu.findOne({ where: { pathname: body.pathname } });
}

describe("access menu API", () => {
  it("POST /accessmenu creates an enabled menu", async () => {
    const body = menuBody({ accesslevel: [level, level + 1] });
    const res = await admin.post("/accessmenu").send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.statusMessage).toBe("Access Menu created!");
    const menu = await db.AccessMenu.findOne({ where: { pathname: body.pathname } });
    expect(menu).toMatchObject({ ...body, status: true });
  });

  it.each([
    [{ pathname: undefined }, '"pathname" is required'],
    [{ accesslevel: "1" }, '"accesslevel" must be an array'],
    [{ accesslevel: ["x"] }, '"accesslevel[0]" must be a number'],
    [{ defaultmenuitem: undefined }, '"defaultmenuitem" is required'],
  ])("POST /accessmenu refuses %j", async (overrides, message) => {
    const res = await admin.post("/accessmenu").send(menuBody(overrides));
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it("GET /accessmenu lists the menus, including the seeded ones", async () => {
    const menu = await createMenu();
    const res = await admin.get("/accessmenu");
    expect(res.status).toBe(200);
    const paths = res.body.data.map((m) => m.pathname);
    expect(paths).toContain(menu.pathname);
    expect(paths).toEqual(expect.arrayContaining(["home", "activations", "dealers"]));
  });

  it("GET /accessmenu/:id returns one menu, 404 when unknown", async () => {
    const menu = await createMenu();
    const res = await admin.get(`/accessmenu/${menu.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: menu.id, pathname: menu.pathname });
    expect((await admin.get("/accessmenu/99999999")).status).toBe(404);
  });

  it("GET /accessmenu/listmenu/:level returns the enabled menus of a level", async () => {
    const mine = await createMenu();
    const shared = await createMenu({ accesslevel: [level + 1, level] });
    const other = await createMenu({ accesslevel: [level + 1] });
    const disabled = await createMenu();
    await admin.put(`/accessmenu/updatestatus/${disabled.id}`).send({ status: false }).expect(200);

    const res = await admin.get(`/accessmenu/listmenu/${level}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.id).sort()).toEqual([mine.id, shared.id].sort());
    expect(res.body.data.map((m) => m.id)).not.toContain(other.id);
  });

  it("GET /accessmenu/listdefaultmenu/:level returns only the default menu", async () => {
    await createMenu();
    const home = await createMenu({ defaultmenuitem: true });
    const res = await admin.get(`/accessmenu/listdefaultmenu/${level}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((m) => m.id)).toEqual([home.id]);
  });

  it("the seeded menus give each profile its menus", async () => {
    const paths = async (profile) =>
      (await admin.get(`/accessmenu/listmenu/${profile}`)).body.data.map((m) => m.pathname);
    expect(await paths(PROFILES.ADMIN)).toEqual(
      expect.arrayContaining(["home", "activations", "dealers", "profiles"]),
    );
    expect(await paths(PROFILES.BILLING)).not.toContain("dealers");
    expect(await paths(PROFILES.WAREHOUSE)).toContain("pos");
  });

  it("PUT /accessmenu/:id updates a menu; validates; 404 when unknown", async () => {
    const menu = await createMenu();
    const changes = menuBody({ description: "Renamed", accesslevel: [level, 3] });
    await admin.put(`/accessmenu/${menu.id}`).send(changes).expect(200);
    await menu.reload();
    expect(menu.description).toBe("Renamed");
    expect(menu.accesslevel).toEqual([level, 3]);

    expect((await admin.put(`/accessmenu/${menu.id}`).send({})).status).toBe(400);
    expect((await admin.put("/accessmenu/99999999").send(menuBody())).status).toBe(404);
  });

  it("PUT /accessmenu/updatestatus/:id disables and enables; 404 when unknown", async () => {
    const menu = await createMenu();
    await admin.put(`/accessmenu/updatestatus/${menu.id}`).send({ status: false }).expect(200);
    await menu.reload();
    expect(menu.status).toBe(false);
    await admin.put(`/accessmenu/updatestatus/${menu.id}`).send({ status: true }).expect(200);
    await menu.reload();
    expect(menu.status).toBe(true);
    expect((await admin.put("/accessmenu/updatestatus/99999999").send({ status: true })).status).toBe(404);
  });

  it("DELETE /accessmenu/:id deletes a menu; 404 when unknown", async () => {
    const menu = await createMenu();
    expect((await admin.delete(`/accessmenu/${menu.id}`)).status).toBe(204);
    expect(await db.AccessMenu.findByPk(menu.id)).toBeNull();
    expect((await admin.delete(`/accessmenu/${menu.id}`)).status).toBe(404);
  });

  // BUG: without "status" the answer is 200 "updated!" although nothing changed.
  it.fails("BUG: PUT /accessmenu/updatestatus/:id accepts a missing status", async () => {
    const menu = await createMenu();
    expect((await admin.put(`/accessmenu/updatestatus/${menu.id}`).send({})).status).toBe(400);
  });

  // BUG: any logged-in user can change which menus each profile sees.
  it.fails("BUG: any logged-in user can create, change or delete menus", async () => {
    const menu = await createMenu();
    const billing = await loginAs(PROFILES.BILLING);
    const attempts = [
      await billing.post("/accessmenu").send(menuBody()),
      await billing.put(`/accessmenu/${menu.id}`).send(menuBody()),
      await billing.put(`/accessmenu/updatestatus/${menu.id}`).send({ status: false }),
      await billing.delete(`/accessmenu/${menu.id}`),
    ];
    expect(attempts.map((r) => r.status)).toEqual([403, 403, 403, 403]);
  });
});
