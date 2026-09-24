-- v3: encode recurring mistake patterns mined from 10 historical director/manager
-- change-log editions (24 Jul - 11 Sep 2026) per instruction: "make sure review
-- and don't repeat same mistakes every week."

-- Distinguish "duplicate within this same edition" (a genuinely new detector —
-- Section 2 restating Section 1/3, Speed Read restating the Executive Summary,
-- two Pulse rows telling the same story, etc. — flagged in at least 5 separate
-- historical editions) from the existing "duplicate vs a prior week" check.
ALTER TABLE redundancy_matches ADD COLUMN scope TEXT NOT NULL DEFAULT 'cross_week';
-- 'cross_week'  -> same as before: this row vs a row in an earlier brief
-- 'intra_brief' -> this row vs another row in the SAME brief edition

CREATE INDEX IF NOT EXISTS idx_redundancy_scope ON redundancy_matches(scope);
