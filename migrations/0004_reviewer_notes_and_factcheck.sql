-- v5: two new capabilities requested by the consultant after spot-checking the
-- compliance engine against a real director-approved edition (24 Sep 2026):
--  (1) Reviewer comments/dismissal on a compliance finding — so once a human
--      has judged a flagged issue as "not applicable" (or added a note), that
--      judgement PERSISTS across re-runs of Run Check instead of the same
--      false positive reappearing every time. Keyed on a content fingerprint
--      (rule_code + row_id + message) rather than the issue's own auto-
--      incrementing id, since /:id/check deletes and re-inserts all issues
--      on every run.
--  (2) Fact-check results — "Run Fact Check" fetches each row's source_url and
--      asks an LLM to compare the brief's stated figures/wording against the
--      live article, storing a verdict per row so it doesn't need re-fetching
--      every time the tab is opened.

CREATE TABLE IF NOT EXISTS compliance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  row_id INTEGER REFERENCES brief_rows(id) ON DELETE CASCADE, -- nullable: brief-wide issues have no row
  rule_code TEXT NOT NULL,
  fingerprint TEXT NOT NULL, -- stable hash of rule_code + row_id + message, survives issue-id churn on re-check
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'dismissed' | 'acknowledged'
  comment TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_reviews_fingerprint ON compliance_reviews(brief_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_compliance_reviews_brief ON compliance_reviews(brief_id);

-- Add a stable fingerprint column to compliance_issues itself so the API can
-- join issues -> reviews without recomputing the hash on every read.
ALTER TABLE compliance_issues ADD COLUMN fingerprint TEXT;

CREATE TABLE IF NOT EXISTS fact_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  row_id INTEGER NOT NULL REFERENCES brief_rows(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  verdict TEXT NOT NULL, -- 'match' | 'discrepancy' | 'unverifiable'
  summary TEXT NOT NULL, -- short human-readable finding
  details TEXT,          -- JSON array of specific discrepancies (figure/wording -> brief said X, source says Y)
  fetch_status TEXT NOT NULL, -- 'ok' | 'fetch_failed' | 'no_url'
  checked_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fact_checks_row ON fact_checks(row_id);
CREATE INDEX IF NOT EXISTS idx_fact_checks_brief ON fact_checks(brief_id);
