-- Maida Vale Weekly Brief QA & Continuity Desk — initial schema

-- One row per weekly brief edition (the Friday/Thursday filed document)
CREATE TABLE IF NOT EXISTS briefs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_label TEXT NOT NULL,               -- e.g. "Week 39"
  period_start TEXT NOT NULL,             -- ISO date, e.g. 2026-09-21
  period_end TEXT NOT NULL,               -- ISO date, e.g. 2026-09-25
  draft_stage TEXT NOT NULL DEFAULT 'draft1', -- 'draft1' | 'draft2' | 'final'
  title TEXT,                             -- display title e.g. "Weekly Brief — Week 39"
  source_filename TEXT,                   -- original uploaded filename
  source_file_type TEXT,                  -- 'docx' | 'pdf' | 'manual'
  r2_key TEXT,                            -- original file stored in R2 (nullable)
  raw_text TEXT,                          -- extracted plain text (for search/audit)
  status TEXT NOT NULL DEFAULT 'uploaded', -- 'uploaded' | 'checked' | 'reviewed'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_briefs_period ON briefs(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_briefs_week_label ON briefs(week_label);

-- Individual news rows extracted from a brief (Headline/Summary/Impact/Regulatory)
CREATE TABLE IF NOT EXISTS brief_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  sector TEXT NOT NULL,                   -- 'Global' | 'Asia Pacific' | 'Malaysia Macro' | 'Ports/Infra/Logistics' | 'Automotive' | 'Agriculture' | 'Energy' | 'Digital' | 'Property' | 'Aviation' | 'Banking' | 'Watchlist' | 'Speed Read' | 'Other'
  row_order INTEGER NOT NULL DEFAULT 0,
  headline TEXT NOT NULL,
  source_name TEXT,                       -- e.g. "The Star", "Reuters"
  source_date TEXT,                       -- date as stated in brief, e.g. "22 Sept 2026"
  source_url TEXT,
  summary TEXT,
  impact_grade TEXT,                      -- 'Positive' | 'Negative' | 'Neutral' | 'Mixed' | null
  impact_text TEXT,
  regulatory_text TEXT,
  entities TEXT,                          -- JSON array of matched Al Bukhary entity names
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rows_brief ON brief_rows(brief_id);
CREATE INDEX IF NOT EXISTS idx_rows_sector ON brief_rows(sector);

-- Daily news log entries (Monday-Thursday tracking before Friday's brief)
CREATE TABLE IF NOT EXISTS daily_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  log_date TEXT NOT NULL,                 -- ISO date
  sector TEXT NOT NULL,
  headline TEXT NOT NULL,
  source_name TEXT,
  source_url TEXT,
  note TEXT,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'high' | 'normal' | 'watch'
  used_in_brief_id INTEGER REFERENCES briefs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_log_date ON daily_log(log_date);

-- Al Bukhary Group entity/ownership map used for entity-name compliance checks
CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,              -- e.g. "Malakoff"
  sector TEXT,                            -- e.g. "Energy/Power"
  relationship TEXT,                      -- 'subsidiary' | 'associate' | 'jv' | 'parent'
  ownership_pct REAL,                     -- e.g. 38.45
  parent_entity TEXT,                     -- e.g. "MMC Corporation"
  aliases TEXT,                           -- JSON array of alternate names/misnomers to catch
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Compliance findings for a brief_row (banned words, format, X-from-Y, etc.)
CREATE TABLE IF NOT EXISTS compliance_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  row_id INTEGER REFERENCES brief_rows(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,                -- 'banned_word' | 'impact_opener' | 'x_from_y' | 'entity_generic' | 'entity_alias' | 'no_source' | 'weak_language' | 'grammar'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'error' | 'warning' | 'info'
  message TEXT NOT NULL,
  excerpt TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_compliance_brief ON compliance_issues(brief_id);

-- Redundancy matches between a row in one brief and a row in a prior brief
CREATE TABLE IF NOT EXISTS redundancy_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  row_id INTEGER NOT NULL REFERENCES brief_rows(id) ON DELETE CASCADE,
  prior_brief_id INTEGER NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  prior_row_id INTEGER NOT NULL REFERENCES brief_rows(id) ON DELETE CASCADE,
  similarity_score REAL NOT NULL,         -- 0-1
  match_type TEXT NOT NULL,               -- 'likely_duplicate' | 'continuing_story' | 'similar_topic'
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_redundancy_brief ON redundancy_matches(brief_id);
