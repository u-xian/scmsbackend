/*
  Approval workflow of activations. All state changes go through here.

    step                  from               to
    create                -                  draft
    send                  draft              pending_level2
    approve (level 2)     pending_level2     pending_level3
    approve (level 3)     pending_level3     approved (cards active)
    reject (level 2 or 3) pending_level2/3   rejected (back to submitter)
    send again            rejected           pending_level2

  Rules:
  - The submitter prepares the activation as a draft (dealer and card
    ranges), then sends it to level 2. From then on the submitter cannot
    change anything, until a level rejects it and sends it back.
  - Only the submitter or an admin changes an activation or its card
    ranges, and only while it is a draft or rejected. The same holds for
    deleting it, which also deletes all its card ranges.
  - An activation is sent (or sent again) only with at least one card range.
  - Levels go in order: level 2 (accounting) approves or rejects an
    activation waiting for level 2, then level 3 (billing) one waiting for
    level 3. The level comes from the user's profile, never from the request.
  - Nobody approves or rejects an activation they submitted.
  - A rejection needs a reason and sends the activation back to the
    submitter. Sent again, it restarts at level 2.
  - Card ranges of a batch never overlap (server/services/cardRanges.js).
    Sending and each approval check it again, which also catches overlaps
    in data saved before this rule existed.
  - The final approval (level 3) activates the cards and marks the
    activation approved in one transaction: everything is saved or nothing.
  - Each step locks the activation row, so two steps cannot overlap.
  - Every step is recorded in ActivationEvents, in the same transaction.
*/
const {
  sequelize,
  Activations,
  ActivationEvents,
  Cardsdetails,
} = require("../models");
const { ACTIONS } = require("../models/activationevents");
const { PROFILES } = require("../middleware/requireProfile");
const { DECISION, STATUS, STATES, stateOf } = require("./activationState");
const { findOverlappingRange, describeOverlap } = require("./cardRanges");

const LEVEL_OF_PROFILE = Object.freeze({
  [PROFILES.ACCOUNTING]: 2,
  [PROFILES.BILLING]: 3,
});

const PENDING_STATE_OF_LEVEL = Object.freeze({
  2: STATES.PENDING_LEVEL2,
  3: STATES.PENDING_LEVEL3,
});

// The submitter can change (and delete) the activation only in these states.
const EDITABLE_STATES = [STATES.DRAFT, STATES.REJECTED];

// Error with an HTTP status, answered as is by the error handler.
class WorkflowError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "WorkflowError";
    this.status = status;
    this.expose = true;
  }
}

const describeState = {
  [STATES.DRAFT]: "is a draft, not sent to level 2 yet",
  [STATES.PENDING_LEVEL2]: "is waiting for level 2 approval",
  [STATES.PENDING_LEVEL3]: "is waiting for level 3 approval",
  [STATES.APPROVED]: "is already approved",
  [STATES.REJECTED]: "was rejected and must be sent again first",
};

const stateMessage = (state) =>
  `The activation ${describeState[state] || "is in an unexpected state"}`;

const isAdmin = (user) => user.profileId === PROFILES.ADMIN;
const isSubmitter = (activation, user) => activation.userid === user.userid;

// Runs fn(activation, transaction) with the activation row locked.
function withLockedActivation(activationId, fn) {
  return sequelize.transaction(async (transaction) => {
    const activation = await Activations.findByPk(activationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!activation) throw new WorkflowError(404, "Activation  not found");
    return fn(activation, transaction);
  });
}

function recordEvent(activation, user, level, action, reason, transaction) {
  return ActivationEvents.create(
    {
      act_id: activation.id,
      userid: user.userid,
      level,
      action,
      reason: reason || null,
    },
    { transaction },
  );
}

function checkSubmitterOrAdmin(activation, user, message) {
  if (!isSubmitter(activation, user) && !isAdmin(user))
    throw new WorkflowError(403, message);
}

// The card ranges of the activation; refused when there is none, or when
// one overlaps a range of another activation.
async function checkRanges(activation, transaction, { emptyMessage, hint }) {
  const ranges = await Cardsdetails.findAll({
    where: { act_id: activation.id },
    transaction,
  });
  if (ranges.length === 0) throw new WorkflowError(409, emptyMessage);

  for (const range of ranges) {
    const overlap = await findOverlappingRange(
      {
        batch: range.batch,
        start: range.start_serialnumber,
        end: range.end_serialnumber,
        excludeActId: activation.id,
      },
      { transaction },
    );
    if (overlap)
      throw new WorkflowError(
        409,
        `${describeOverlap(range, overlap)}. ${hint}`,
      );
  }
}

// Checks shared by approve and reject. Returns the user's level.
function checkDecision(activation, user) {
  const level = LEVEL_OF_PROFILE[user.profileId];
  if (!level)
    throw new WorkflowError(
      403,
      "Your profile cannot approve or reject activations",
    );

  const state = stateOf(activation);
  if (state !== PENDING_STATE_OF_LEVEL[level])
    throw new WorkflowError(409, stateMessage(state));

  if (isSubmitter(activation, user))
    throw new WorkflowError(
      403,
      "You cannot approve or reject an activation you submitted",
    );
  return level;
}

// New activation, as a draft of the user.
function create({ dealer_id }, user) {
  return sequelize.transaction(async (transaction) => {
    const activation = await Activations.create(
      {
        dealer_id,
        userid: user.userid,
        status: STATUS.PENDING,
        confirmation_lvl1: DECISION.PENDING,
        confirmation_lvl2: DECISION.PENDING,
        confirmation_lvl3: DECISION.PENDING,
      },
      { transaction },
    );
    await recordEvent(activation, user, 1, ACTIONS.CREATED, null, transaction);
    return activation;
  });
}

// Sends a draft (send) or a rejected activation (send again) to level 2.
function sendToLevel2(fromState, action) {
  return (activationId, user, comment) =>
    withLockedActivation(activationId, async (activation, transaction) => {
      checkSubmitterOrAdmin(
        activation,
        user,
        "Only the submitter or an admin can send this activation",
      );

      const state = stateOf(activation);
      if (state !== fromState)
        throw new WorkflowError(409, stateMessage(state));

      await checkRanges(activation, transaction, {
        emptyMessage: "Add at least one card range before sending",
        hint: "Correct the range before sending",
      });

      await activation.update(
        {
          confirmation_lvl1: DECISION.APPROVED,
          confirmation_lvl2: DECISION.PENDING,
          confirmation_lvl3: DECISION.PENDING,
          status: STATUS.PENDING,
        },
        { transaction },
      );
      await recordEvent(activation, user, 1, action, comment, transaction);
      return activation;
    });
}

const submit = sendToLevel2(STATES.DRAFT, ACTIONS.SUBMITTED);
const resubmit = sendToLevel2(STATES.REJECTED, ACTIONS.RESUBMITTED);

function approve(activationId, user) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    const level = checkDecision(activation, user);
    await checkRanges(activation, transaction, {
      emptyMessage: "An activation without card details cannot be approved",
      hint: "Reject the activation so the submitter can correct the range",
    });

    if (level === 2) {
      await activation.update(
        { confirmation_lvl2: DECISION.APPROVED },
        { transaction },
      );
    } else {
      // Final approval: cards and activation change together.
      const now = new Date();
      await Cardsdetails.update(
        { status: true, activated_at: now },
        { where: { act_id: activation.id }, transaction },
      );
      await activation.update(
        {
          confirmation_lvl3: DECISION.APPROVED,
          status: STATUS.APPROVED,
          activated_at: now,
        },
        { transaction },
      );
    }
    await recordEvent(
      activation,
      user,
      level,
      ACTIONS.APPROVED,
      null,
      transaction,
    );
    return activation;
  });
}

function reject(activationId, user, reason) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    const level = checkDecision(activation, user);
    await activation.update(
      {
        [`confirmation_lvl${level}`]: DECISION.REJECTED,
        status: STATUS.REJECTED,
      },
      { transaction },
    );
    await recordEvent(
      activation,
      user,
      level,
      ACTIONS.REJECTED,
      reason,
      transaction,
    );
    return activation;
  });
}

// Runs fn(activation, transaction) if the user may change this activation
// or its card ranges now: submitter or admin, draft or rejected.
function withEditableActivation(activationId, user, fn) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    checkSubmitterOrAdmin(
      activation,
      user,
      "Only the submitter or an admin can change this activation",
    );

    const state = stateOf(activation);
    if (!EDITABLE_STATES.includes(state))
      throw new WorkflowError(
        409,
        `${stateMessage(state)}. An activation can only be changed as a ` +
          "draft or after a rejection",
      );
    return fn(activation, transaction);
  });
}

// Deletes the activation and all its card ranges (draft or rejected only).
const deleteActivation = (activationId, user) =>
  withEditableActivation(
    activationId,
    user,
    async (activation, transaction) => {
      await Cardsdetails.destroy({
        where: { act_id: activation.id },
        transaction,
      });
      await activation.destroy({ transaction });
    },
  );

module.exports = {
  WorkflowError,
  LEVEL_OF_PROFILE,
  create,
  submit,
  resubmit,
  approve,
  reject,
  withEditableActivation,
  deleteActivation,
};
