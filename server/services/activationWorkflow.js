/*
  Approval workflow of activations. All state changes go through here.

  Rules:
  - Levels go in order: level 2 (accounting) approves or rejects an
    activation waiting for level 2, then level 3 (billing) one waiting for
    level 3. The level comes from the user's profile, never from the request.
  - Nobody approves or rejects an activation they submitted.
  - An activation without card details cannot be approved.
  - A rejection needs a reason. It sends the activation back to the
    submitter, who can change it and send it again (it restarts at level 2).
  - Only the submitter or an admin changes an activation or its card
    details, and only while nobody has approved it yet (waiting for level 2)
    or after a rejection.
  - The final approval (level 3) activates the cards and marks the
    activation approved in one transaction: everything is saved or nothing.
  - Each step locks the activation row, so two decisions cannot overlap.
  - Every step is recorded in ActivationEvents.
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

const LEVEL_OF_PROFILE = Object.freeze({
  [PROFILES.ACCOUNTING]: 2,
  [PROFILES.BILLING]: 3,
});

const PENDING_STATE_OF_LEVEL = Object.freeze({
  2: STATES.PENDING_LEVEL2,
  3: STATES.PENDING_LEVEL3,
});

const EDITABLE_STATES = [STATES.PENDING_LEVEL2, STATES.REJECTED];

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

async function submit({ dealer_id }, user) {
  return sequelize.transaction(async (transaction) => {
    const activation = await Activations.create(
      {
        dealer_id,
        userid: user.userid,
        status: STATUS.PENDING,
        confirmation_lvl1: DECISION.APPROVED,
        confirmation_lvl2: DECISION.PENDING,
        confirmation_lvl3: DECISION.PENDING,
      },
      { transaction },
    );
    await recordEvent(
      activation,
      user,
      1,
      ACTIONS.SUBMITTED,
      null,
      transaction,
    );
    return activation;
  });
}

function approve(activationId, user) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    const level = checkDecision(activation, user);

    const cards = await Cardsdetails.count({
      where: { act_id: activation.id },
      transaction,
    });
    if (cards === 0)
      throw new WorkflowError(
        409,
        "An activation without card details cannot be approved",
      );

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

function resubmit(activationId, user, comment) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    if (!isSubmitter(activation, user) && !isAdmin(user))
      throw new WorkflowError(
        403,
        "Only the submitter or an admin can send an activation again",
      );

    const state = stateOf(activation);
    if (state !== STATES.REJECTED)
      throw new WorkflowError(409, stateMessage(state));

    await activation.update(
      {
        confirmation_lvl2: DECISION.PENDING,
        confirmation_lvl3: DECISION.PENDING,
        status: STATUS.PENDING,
      },
      { transaction },
    );
    await recordEvent(
      activation,
      user,
      1,
      ACTIONS.RESUBMITTED,
      comment,
      transaction,
    );
    return activation;
  });
}

// Runs fn(activation, transaction) if the user may change this activation
// or its card details now.
function withEditableActivation(activationId, user, fn) {
  return withLockedActivation(activationId, async (activation, transaction) => {
    if (!isSubmitter(activation, user) && !isAdmin(user))
      throw new WorkflowError(
        403,
        "Only the submitter or an admin can change this activation",
      );

    const state = stateOf(activation);
    if (!EDITABLE_STATES.includes(state))
      throw new WorkflowError(
        409,
        `${stateMessage(state)}: it can no longer be changed`,
      );
    return fn(activation, transaction);
  });
}

module.exports = {
  WorkflowError,
  LEVEL_OF_PROFILE,
  submit,
  approve,
  reject,
  resubmit,
  withEditableActivation,
};
