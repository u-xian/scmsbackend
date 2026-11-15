/*
  Checks that apply to every route. The list of routes is read from the
  routers themselves, so a new route is checked without changing this file.
*/
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { api, db } = require("../helpers/testApp");

afterAll(() => db.sequelize.close());

const ROUTES_DIR = path.join(__dirname, "../../server/routes");
const routes = fs
  .readdirSync(ROUTES_DIR)
  .filter((file) => file.endsWith("Route.js"))
  .flatMap((file) =>
    require(path.join(ROUTES_DIR, file))
      .stack.filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map((method) => ({
          method,
          path: layer.route.path,
        })),
      ),
  );

// Routes that work without a token (login and password change).
const PUBLIC = ["post /auth", "put /auth/:userId"];
const isPublic = (r) => PUBLIC.includes(`${r.method} ${r.path}`);
const withIds = (p) => `/api/v1${p.replace(/:\w+/g, "1")}`;

describe("all routes", () => {
  it("finds every route of the API", () => {
    // 60 routes today: update this number when routes are added or removed.
    expect(routes).toHaveLength(60);
    expect(routes.filter(isPublic)).toHaveLength(2);
  });

  it("GET /api/v1/ answers with a welcome message", async () => {
    const res = await api().get("/api/v1/");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Welcome to the SCMS Backend API" });
  });

  it("an unknown path answers 404", async () => {
    expect((await api().get("/api/v1/nothing-here")).status).toBe(404);
  });

  const protectedRoutes = routes.filter((r) => !isPublic(r));

  it.each(protectedRoutes)("$method $path refuses a request without a token", async (r) => {
    const res = await api()[r.method](withIds(r.path));
    expect(res.status).toBe(401);
    expect(res.text).toBe("Access denied. No token provided.");
  });

  it.each(protectedRoutes)("$method $path refuses an invalid token", async (r) => {
    const res = await api()[r.method](withIds(r.path)).set("x-auth-token", "not-a-token");
    expect(res.status).toBe(400);
    expect(res.text).toBe("Invalid token.");
  });
});
