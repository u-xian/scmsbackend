import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { db, PROFILES, TEST_PREFIX, loginAs, cleanUp } = require("../helpers/testApp");

beforeAll(cleanUp);
afterAll(async () => {
  await cleanUp();
  await db.sequelize.close();
});

let author, other, activationId;
beforeEach(async () => {
  author = await loginAs(PROFILES.ACCOUNTING, { name: "Ann Author" });
  other = await loginAs(PROFILES.BILLING);
  const res = await author.post("/activations").send({ dealer_id: 1 });
  activationId = res.body.data.activId;
});

const text = (words = "about this activation") => `${TEST_PREFIX}${words}`;
const commentBody = (overrides = {}) => ({
  comment_text: text(),
  act_id: activationId,
  userid: author.user.id,
  ...overrides,
});

async function createComment(overrides) {
  const body = commentBody(overrides);
  await author.post("/comments").send(body).expect(200);
  return db.Comments.findOne({ where: { comment_text: body.comment_text } });
}

describe("comments API", () => {
  it("POST /comments creates a comment", async () => {
    const body = commentBody({ comment_text: text("please check batch 12") });
    const res = await author.post("/comments").send(body);
    expect(res.status).toBe(200);
    expect(res.body.data.statusMessage).toBe("Comment created!");
    expect(await db.Comments.findOne({ where: { comment_text: body.comment_text } })).toMatchObject(body);
  });

  it.each([
    [{ comment_text: undefined }, '"comment_text" is required'],
    [{ comment_text: "x" }, '"comment_text" length must be at least 2 characters long'],
    [{ comment_text: "x".repeat(201) }, '"comment_text" length must be less than or equal to 200 characters long'],
    [{ act_id: undefined }, '"act_id" is required'],
  ])("POST /comments refuses %j", async (overrides, message) => {
    const res = await author.post("/comments").send(commentBody(overrides));
    expect(res.status).toBe(400);
    expect(res.text).toBe(message);
  });

  it("GET /comments lists comments, newest first, with the author's name", async () => {
    const first = await createComment({ comment_text: text("first") });
    const second = await createComment({ comment_text: text("second") });
    const res = await other.get("/comments");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((c) => c.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
    const found = res.body.data.find((c) => c.id === first.id);
    expect(found.agents).toEqual({ id: author.user.id, name: "Ann Author" });
  });

  it("GET /comments/:id returns one comment; 404 when unknown", async () => {
    const comment = await createComment();
    const res = await other.get(`/comments/${comment.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: comment.id, comment_text: comment.comment_text });
    expect((await other.get("/comments/99999999")).status).toBe(404);
  });

  it("PUT /comments/:id updates a comment; validates; 404 when unknown", async () => {
    const comment = await createComment();
    const newText = text("corrected text");
    await author.put(`/comments/${comment.id}`).send(commentBody({ comment_text: newText })).expect(200);
    await comment.reload();
    expect(comment.comment_text).toBe(newText);

    expect((await author.put(`/comments/${comment.id}`).send({})).status).toBe(400);
    expect((await author.put("/comments/99999999").send(commentBody())).status).toBe(404);
  });

  it("DELETE /comments/:id deletes a comment; 404 when unknown", async () => {
    const comment = await createComment();
    expect((await author.delete(`/comments/${comment.id}`)).status).toBe(204);
    expect(await db.Comments.findByPk(comment.id)).toBeNull();
    expect((await author.delete(`/comments/${comment.id}`)).status).toBe(404);
  });

  // BUG: the author is taken from the body, so anyone can post in the name
  // of another user.
  it.fails("BUG: a comment is saved under the userid sent in the body", async () => {
    await other.post("/comments").send(commentBody({ comment_text: text("fake author") }));
    const saved = await db.Comments.findOne({ where: { comment_text: text("fake author") } });
    expect(saved.userid).toBe(other.user.id);
  });

  // BUG: no check of the author: any user changes or deletes anyone's comment.
  it.fails("BUG: any user can change or delete someone else's comment", async () => {
    const comment = await createComment();
    const change = await other.put(`/comments/${comment.id}`).send(commentBody({ comment_text: text("changed") }));
    const remove = await other.delete(`/comments/${comment.id}`);
    expect([change.status, remove.status]).toEqual([403, 403]);
  });

  // BUG: act_id is not checked.
  it.fails("BUG: a comment can point to an activation that does not exist", async () => {
    const res = await author.post("/comments").send(commentBody({ act_id: 99999999 }));
    expect(res.status).toBe(404);
  });
});
