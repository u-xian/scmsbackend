const _ = require("lodash");
const Profiles = require("../models").Profiles;
const { validate } = require("../models/profiles");

const profilesCrontroller = {
  create: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const profile = await Profiles.create({
      profilename: req.body.profilename,
      status: true,
    });

    if (!profile) return res.status(404).send("Profile  not found");
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Profile created!" } });
  },
  list: async (req, res) => {
    const profiles = await Profiles.findAll({ order: [["createdAt", "DESC"]] });
    if (!profiles) return res.status(404).send("Profiles  not found");
    res.status(200).json({ data: profiles });
  },
  listById: async (req, res) => {
    const profile = await Profiles.findByPk(req.params.profileId);
    if (!profile) return res.status(404).send("Profile  not found");
    res.status(200).json({ data: profile });
  },
  update: async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);
    let profile = await Profiles.findByPk(req.params.profileId);
    if (!profile) return res.status(404).send("Profile  not found");
    profile.update(req.body, { fields: Object.keys(req.body) });
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Profile updated!" } });
  },
  updateStatus: async (req, res) => {
    let profile = await Profiles.findByPk(req.params.profileId);
    if (!profile) return res.status(404).send("Profile  not found");
    profile.update({ status: req.body.status });
    profile = await profile.save();
    res
      .status(200)
      .json({ data: { status: 1, statusMessage: "Profile updated!" } });
  },
  delete: async (req, res) => {
    let profile = await Profiles.findByPk(req.params.profileId);
    if (!profile) return res.status(404).send("Profile  not found");
    profile.destroy();
    res.status(204).send("profile deleted");
  },
};

module.exports = profilesCrontroller;
