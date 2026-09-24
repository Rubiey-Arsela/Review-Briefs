// Automatic daily news sweep. Cloudflare Pages hosted deploy has no background
// cron ("triggers" is an unsupported wrangler field there), so this is a "lazy
// cron": the sweep runs at most once per calendar day (Asia/Kuala_Lumpur), kicked
// off automatically the first time anyone hits GET /api/daily-log that day. A
// "Run Sweep Now" button also calls it directly for an on-demand refresh.
//
// It only checks outlets with a free, reliable public RSS feed that can actually
// be fetched headlessly — Reuters/The Star/The Edge/NST/The Sun's own site
// (thesundaily.my)/Free Malaysia Today/Borneo Post all return 403/404 or sit
// behind a Cloudflare bot challenge and cannot be fetched from the edge; those
// still rely on the consultant's manual entry + the Source Cross-Check search
// links.
//
// NOTE (24 Sep 2026 fix #1): the original feed URLs for Bernama
// ("/en/rss/general.xml") and NST ("/rss/latest") were both dead — Bernama's
// returned a plain 404, and NST's sits behind a Cloudflare "Just a moment..."
// bot-challenge page (403), so those two outlets silently produced zero items on
// every sweep and only The Guardian's Malaysia-only feed (which rarely mentions
// a named Al Bukhary entity or the curated keywords) was actually contributing —
// this is why "Run Sweep Now" was only ever surfacing ~1 headline. Bernama's
// working feed is "/en/rssfeed.php"; no working public NST feed could be found,
// so it was replaced with Malay Mail's feed (also one of the consultant's 6
// primary sources).
//
// NOTE (24 Sep 2026 fix #2): ran a GenTeam Deep Research audit of every
// Malaysian outlet's public RSS status, then independently re-verified each
// candidate directly (the research agent's own live-fetch tests, cross-checked
// against a second fetch from this sandbox — several outlets it reported as
// "confirmed working" failed on retest and were excluded):
//   - Free Malaysia Today (both /feed/ and /category/business/feed/) -> 403
//     Cloudflare challenge on every attempt. EXCLUDED.
//   - The Malaysian Insight (/feed) -> returns HTTP 200 but every item is
//     dated 2024-2025 (stale/abandoned feed, not live). EXCLUDED.
//   - Borneo Post (/feed/) -> 403 Cloudflare challenge. EXCLUDED.
//   - CodeBlue (/feed/) -> flaky (429 rate-limited on first hit, 200 on
//     retry) — too unreliable for an unattended scheduled sweep. EXCLUDED.
// Three additional outlets verified genuinely working with fresh, same-day
// items and added below: Malaysiakini (malaysiakini.com/rss/en/news.rss),
// The Vibes (thevibes.com/rss, ~100 items), and The Sun (thesun.my/rss — the
// live wordpress site, distinct from the dead thesundaily.my). This roughly
// doubles outlet coverage from 3 to 6 and adds two more of the consultant's
// beat topics (political/policy signal from Malaysiakini, broad wire-style
// volume from The Vibes).
import type { Bindings, Entity } from './types'
import { parseRssItems } from './rss'
import { CURATED_KEYWORDS } from './watchlist'

const RSS_FEEDS: Record<string, string> = {
  Bernama: 'https://www.bernama.com/en/rssfeed.php',
  'Malay Mail': 'https://www.malaymail.com/feed/rss/malaysia',
  'The Guardian': 'https://www.theguardian.com/world/malaysia/rss',
  Malaysiakini: 'https://www.malaysiakini.com/rss/en/news.rss',
  'The Vibes': 'https://www.thevibes.com/rss',
  'The Sun': 'https://thesun.my/rss',
}

interface WatchTerm {
  term: string
  sector: string
  priority: 'high' | 'normal'
}

// Asia/Kuala_Lumpur is UTC+8 year-round (no DST) — compute the local date without
// relying on Intl/timezone DB support in the Workers runtime.
export function todayKL(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 10)
}

function buildWatchTerms(entities: Entity[]): WatchTerm[] {
  const terms: WatchTerm[] = []
  for (const e of entities) {
    terms.push({ term: e.name, sector: e.sector || 'Other', priority: 'high' })
    try {
      const aliases: string[] = e.aliases ? JSON.parse(e.aliases) : []
      for (const a of aliases) {
        if (a && a.trim()) terms.push({ term: a, sector: e.sector || 'Other', priority: 'high' })
      }
    } catch {
      /* ignore malformed alias JSON */
    }
  }
  terms.push(...CURATED_KEYWORDS)
  return terms
}

function matchTerm(title: string, terms: WatchTerm[]): WatchTerm | null {
  const lower = title.toLowerCase()
  for (const t of terms) {
    const needle = t.term.toLowerCase()
    if (needle.length < 3) continue // skip too-short terms like "SAC"/"TBIP" false-positive risk unless escaped
    // simple word/phrase boundary check
    const idx = lower.indexOf(needle)
    if (idx === -1) continue
    const before = idx === 0 ? ' ' : lower[idx - 1]
    const after = idx + needle.length >= lower.length ? ' ' : lower[idx + needle.length]
    const isWordChar = (c: string) => /[a-z0-9]/.test(c)
    if (!isWordChar(before) && !isWordChar(after)) return t
  }
  return null
}

export interface SweepResult {
  ran: boolean
  reason?: string
  checked_outlets: string[]
  items_seen: number
  new_entries: number
  matches: { headline: string; outlet: string; sector: string; term: string }[]
}

export async function runAutoSweep(db: Bindings['DB'], force = false): Promise<SweepResult> {
  const today = todayKL()

  if (!force) {
    const last = await db.prepare("SELECT value FROM app_settings WHERE key = 'last_sweep_date'").first<{ value: string }>()
    if (last?.value === today) {
      return { ran: false, reason: 'Already swept today', checked_outlets: [], items_seen: 0, new_entries: 0, matches: [] }
    }
  }

  const { results: entityRows } = await db.prepare('SELECT * FROM entities').all<Entity>()
  const terms = buildWatchTerms(entityRows || [])

  const checkedOutlets: string[] = []
  let itemsSeen = 0
  let newEntries = 0
  const matches: SweepResult['matches'] = []

  for (const [outlet, feedUrl] of Object.entries(RSS_FEEDS)) {
    checkedOutlets.push(outlet)
    try {
      const resp = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaidaValeQA/1.0)' } })
      if (!resp.ok) continue
      const xml = await resp.text()
      const items = parseRssItems(xml, 30)
      itemsSeen += items.length

      for (const item of items) {
        const hit = matchTerm(item.title, terms)
        if (!hit) continue

        try {
          const result = await db
            .prepare(
              `INSERT OR IGNORE INTO daily_log
                (log_date, sector, headline, source_name, source_url, note, priority, origin, matched_term)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'auto', ?)`
            )
            .bind(today, hit.sector, item.title, outlet, item.link, null, hit.priority, hit.term)
            .run()

          if (result.meta.changes > 0) {
            newEntries++
            matches.push({ headline: item.title, outlet, sector: hit.sector, term: hit.term })
          }
        } catch {
          /* duplicate source_url or other insert issue — skip silently */
        }
      }
    } catch {
      /* feed unreachable — skip this outlet for today's sweep */
    }
  }

  await db
    .prepare(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ('last_sweep_date', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .bind(today)
    .run()

  return { ran: true, checked_outlets: checkedOutlets, items_seen: itemsSeen, new_entries: newEntries, matches }
}
