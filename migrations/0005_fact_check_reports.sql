-- Deep Fact-Check reports: a whole-brief, multi-source verification report
-- (topic-grouped claims, each checked against independently-named external
-- sources — not just the brief's own embedded link). Generation happens via
-- the research consultant's AI assistant (real web search + verification),
-- then POSTed here to be stored and displayed in-app. This is deliberately
-- NOT a live in-app button calling a search API from the Worker — Cloudflare
-- Workers cannot do open-ended web search without a paid third-party search
-- API, which has not been set up. See README for the request flow.
CREATE TABLE IF NOT EXISTS fact_check_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                    -- e.g. "Fact Check: Maida Vale Weekly Brief (25 Sept 2026)"
  overall_verdict TEXT NOT NULL,          -- e.g. "Substantially Accurate With Minor Discrepancies"
  overall_summary TEXT NOT NULL,          -- the lead summary paragraph
  sections_json TEXT NOT NULL,            -- JSON array: [{ section_name, claims: [{ claim_number, marker ('✅'|'⚠️'), quoted_text, verdict_tag, sources: [{ quote, source_name, source_date, source_url }] }] }]
  summary_table_json TEXT NOT NULL,       -- JSON array: [{ claim_number, verdict_line }]
  conclusion TEXT NOT NULL,               -- final conclusion paragraph
  minor_issues_json TEXT,                 -- JSON array of strings, nullable ("Minor issues found (none material)")
  report_markdown TEXT NOT NULL,          -- full report rendered as markdown/plain text, for copy-paste into director email
  generated_by TEXT NOT NULL DEFAULT 'consultant_via_agent',
  claim_count INTEGER NOT NULL DEFAULT 0,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  discrepancy_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fact_check_reports_brief ON fact_check_reports(brief_id, created_at DESC);
