-- PostgreSQL truncated the original overlong identifier differently from
-- Prisma's deterministic name. Normalize it so migration output and schema
-- introspection stay identical.
ALTER INDEX IF EXISTS
"roast_material_reservations_parentBatchId_lotId_sourceLocationI"
RENAME TO "roast_material_reservations_parentBatchId_lotId_sourceLocat_key";
