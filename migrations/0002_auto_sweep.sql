-- Auto-sweep support: track where a daily_log entry came from, dedupe by source_url,
-- and remember when the last automatic sweep ran (used for once-per-day lazy trigger
-- since Cloudflare Pages hosted deploy has no background cron).

ALTER TABLE daily_log ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'; -- 'auto' | 'manual'
ALTER TABLE daily_log ADD COLUMN matched_term TEXT; -- the entity/keyword that triggered an auto entry

-- Prevent the same feed item being logged twice by the sweep
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_log_source_url ON daily_log(source_url) WHERE source_url IS NOT NULL;

-- Small key/value settings table (last sweep date, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
