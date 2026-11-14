/*
  States of an activation, derived from its confirmation columns.

  Level 1 is the submission, level 2 the accounting approval, level 3 the
  billing (final) approval. Each confirmation column holds:
    0 -> waiting, 1 -> approved, 2 -> rejected

    pending_level2   lvl2 = 0, lvl3 = 0
    pending_level3   lvl2 = 1, lvl3 = 0
    approved         lvl3 = 1   (cards are active)
    rejected         lvl2 = 2 or lvl3 = 2 (back to the submitter)

  The "status" column follows: 0 pending, 1 approved, 2 rejected.
*/
const { Op } = require("sequelize");

const DECISION = Object.freeze({ PENDING: 0, APPROVED: 1, REJECTED: 2 });
const STATUS = Object.freeze({ PENDING: 0, APPROVED: 1, REJECTED: 2 });

const STATES = Object.freeze({
  PENDING_LEVEL2: "pending_level2",
  PENDING_LEVEL3: "pending_level3",
  APPROVED: "approved",
  REJECTED: "rejected",
});

function stateOf(activation) {
  const lvl2 = activation.confirmation_lvl2;
  const lvl3 = activation.confirmation_lvl3;
  if (lvl3 === DECISION.APPROVED) return STATES.APPROVED;
  if (lvl2 === DECISION.REJECTED || lvl3 === DECISION.REJECTED)
    return STATES.REJECTED;
  if (lvl2 === DECISION.PENDING && lvl3 === DECISION.PENDING)
    return STATES.PENDING_LEVEL2;
  if (lvl2 === DECISION.APPROVED && lvl3 === DECISION.PENDING)
    return STATES.PENDING_LEVEL3;
  return null; // inconsistent data: no action is allowed
}

// Sequelize "where" clause matching each state (same rules as stateOf).
const WHERE_STATE = Object.freeze({
  [STATES.PENDING_LEVEL2]: {
    confirmation_lvl2: DECISION.PENDING,
    confirmation_lvl3: DECISION.PENDING,
  },
  [STATES.PENDING_LEVEL3]: {
    confirmation_lvl2: DECISION.APPROVED,
    confirmation_lvl3: DECISION.PENDING,
  },
  [STATES.APPROVED]: { confirmation_lvl3: DECISION.APPROVED },
  [STATES.REJECTED]: {
    confirmation_lvl3: { [Op.ne]: DECISION.APPROVED },
    [Op.or]: [
      { confirmation_lvl2: DECISION.REJECTED },
      { confirmation_lvl3: DECISION.REJECTED },
    ],
  },
});

module.exports = { DECISION, STATUS, STATES, stateOf, WHERE_STATE };
