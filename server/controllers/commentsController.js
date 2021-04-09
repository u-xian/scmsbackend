const _ = require("lodash");
const Comments = require("../models").Comments;
const Users = require("../models").Users;
const { validate } = require("../models/comments");

const commentsCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const comment = await Comments.create({
      comment_text: req.body.comment_text,
      act_id: req.body.act_id,
      userid: req.body.userid,
    });

    if (!comment) return res.status(404).send("Comment  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Comment created!" } });
  },
  list: async (req, res) => {
    const comments = await Comments.findAll({
      include: [
        {
          model: Users,
          as: "agents",
          attributes: ["id", "name"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });
    if (!comments) return res.status(404).send("Comments  not found");
    res.status(200).json({ data: comments });
  },
  listById: async (req, res) => {
    const comment = await Comments.findByPk(req.params.commentId);
    if (!comment) return res.status(404).send("Comment  not found");
    res.status(200).json({ data: comment });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let comment = await Comments.findByPk(req.params.commentId);
    if (!comment) return res.status(404).send("Comment  not found");
    comment.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Comment updated!" } });
  },
  delete: async (req, res) => {
    let comment = await Comments.findByPk(req.params.commentId);
    if (!comment) return res.status(404).send("Comment  not found");
    comment.destroy();
    res.status(204).send("Comment deleted");
  },
};

module.exports = commentsCrontroller;
