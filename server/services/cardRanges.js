/*
  Card ranges of the same batch must never overlap: otherwise the same cards
  would belong to two activations and could be activated twice.

  Serial numbers are stored as text; they are compared as numbers (leading
  zeros allowed, any length).
*/
const { QueryTypes } = require("sequelize");
const { sequelize } = require("../models");

/*
  Returns the first range of `batch` that overlaps [start, end], or null.
  Ranges with id `excludeId` or belonging to activation `excludeActId` are
  ignored. Deleted ranges are ignored.

  With `lockBatch`, first takes a lock on the batch for the rest of the
  transaction, so two requests adding ranges to the same batch cannot both
  pass the check.
*/
async function findOverlappingRange(
  { batch, start, end, excludeId = null, excludeActId = null },
  { transaction, lockBatch = false },
) {
  if (lockBatch)
    await sequelize.query("SELECT pg_advisory_xact_lock(hashtext(:batch))", {
      replacements: { batch },
      transaction,
    });

  // CASE keeps PostgreSQL from converting a non numeric serial (old data).
  const [overlap] = await sequelize.query(
    `SELECT c.id, c.batch, c.start_serialnumber, c.end_serialnumber,
            c.act_id, a.actno
       FROM "Cardsdetails" c
       LEFT JOIN "Activations" a ON a.id = c.act_id
      WHERE c."deletedAt" IS NULL
        AND c.batch = :batch
        AND (CAST(:excludeId AS INTEGER) IS NULL OR c.id <> :excludeId)
        AND (CAST(:excludeActId AS INTEGER) IS NULL OR c.act_id <> :excludeActId)
        AND (
          (c.start_serialnumber = :start AND c.end_serialnumber = :end)
          OR (
            CASE WHEN c.start_serialnumber ~ '^[0-9]+$'
                 THEN c.start_serialnumber::numeric END <= CAST(:end AS NUMERIC)
            AND
            CASE WHEN c.end_serialnumber ~ '^[0-9]+$'
                 THEN c.end_serialnumber::numeric END >= CAST(:start AS NUMERIC)
          )
        )
      ORDER BY c.id
      LIMIT 1`,
    {
      replacements: { batch, start, end, excludeId, excludeActId },
      type: QueryTypes.SELECT,
      transaction,
    },
  );
  return overlap || null;
}

const describeOverlap = (range, overlap) =>
  `Serial numbers ${range.start_serialnumber} to ${range.end_serialnumber} ` +
  `of batch ${range.batch} overlap the range ` +
  `${overlap.start_serialnumber} to ${overlap.end_serialnumber} ` +
  `of activation ${overlap.actno || overlap.act_id}`;

module.exports = { findOverlappingRange, describeOverlap };
