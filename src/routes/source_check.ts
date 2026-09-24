import { Hono } from 'hono'
import type { AppEnv } from '../lib/types'
import { NEWS_SOURCES } from '../lib/types'
import { parseRssItems } from '../lib/rss'

const sourceCheck = new Hono<AppEnv>()

// Public RSS feeds we can safely fetch server-side without a headless browser.
// Reuters/The Star/The Edge/Malay Mail/NST/The Sun/The Guardian mostly block or
// don't expose reliable free RSS at the edge — Bernama and The Guardian have
// stable public feeds; NST has a general feed. Anything not listed falls back
// to search-link-only mode.
const RSS_FEEDS: Record<string, string> = {
  Bernama: 'https://www.bernama.com/en/rss/general.xml',
  NST: 'https://www.nst.com.my/rss/latest',
  'The Guardian': 'https://www.theguardian.com/world/malaysia/rss',
}

// GET /api/source-check/links?headline=...&date=...
// Returns one site-restricted search URL per configured outlet so the user can
// one-click verify a headline instead of typing 8 separate searches.
sourceCheck.get('/links', (c) => {
  const headline = c.req.query('headline') || ''
  const links = NEWS_SOURCES.map((src) => ({
    name: src.name,
    url: `https://www.google.com/search?q=${encodeURIComponent(`site:${src.domain} ${headline}`)}`,
  }))
  return c.json({ headline, links })
})

// GET /api/source-check/feed?outlet=Bernama
// Best-effort: fetch that outlet's public RSS (if we have one configured) so the
// user can eyeball today's headlines next to the brief row. Not available for
// paywalled/bot-protected outlets (Reuters, The Star, The Edge, Malay Mail, The Sun) —
// those return available:false and the UI should offer the search link instead.
sourceCheck.get('/feed', async (c) => {
  const outlet = c.req.query('outlet') || ''
  const feedUrl = RSS_FEEDS[outlet]
  if (!feedUrl) {
    return c.json({ available: false, outlet, reason: 'No public RSS feed configured for this outlet — use the search link instead.' })
  }

  try {
    const resp = await fetch(feedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MaidaValeQA/1.0)' } })
    if (!resp.ok) {
      return c.json({ available: false, outlet, reason: `Feed returned HTTP ${resp.status}` })
    }
    const xml = await resp.text()
    const items = parseRssItems(xml, 20)
    return c.json({ available: true, outlet, items })
  } catch (e) {
    return c.json({ available: false, outlet, reason: 'Feed fetch failed (network or blocked).' })
  }
})

export default sourceCheck
