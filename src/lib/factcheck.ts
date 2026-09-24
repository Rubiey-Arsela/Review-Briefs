// "Run Fact Check" — fetches a brief row's real source_url and asks an LLM to
// compare the brief's stated figures and wording against the live article,
// so the consultant can spot-check "is this actually what the source said"
// without manually re-opening every link. Runs entirely via fetch() + the
// OpenAI-compatible LLM proxy — no Node APIs, safe for Cloudflare Workers.
//
// Design notes:
//  - Only outlets that don't bot-block plain fetches are actually checkable
//    (Reuters returns 401 to a headless fetch; The Star/The Edge/Bernama/BNM/
//    IAEA generally work). When the fetch itself fails, we still return a
//    'unverifiable' result rather than silently doing nothing, so the
//    consultant knows to check that one manually.
//  - We strip HTML to plain text and truncate before sending to the LLM, both
//    to stay within a reasonable prompt size and to avoid sending nav/ad
//    boilerplate that dilutes the comparison.
import type { BriefRow } from './types'

export interface FactCheckResult {
  verdict: 'match' | 'discrepancy' | 'unverifiable'
  summary: string
  details: { field: string; brief_said: string; source_said: string }[]
  fetch_status: 'ok' | 'fetch_failed' | 'no_url'
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    const raw = await res.text()
    if (contentType.includes('pdf')) {
      // Can't parse PDF binary here; treat as fetched-but-not-readable.
      return null
    }
    const text = stripHtml(raw)
    return text.length > 200 ? text : null // too short is usually a challenge/error page
  } catch {
    return null
  }
}

const SYSTEM_PROMPT = `You are a meticulous fact-checker for a corporate weekly industry brief. You will be given:
1. The brief's own text for one news item (headline, summary, impact analysis, regulatory note).
2. The plain-text content of the live source article the brief cites.

Compare ONLY the brief's headline and summary against the source article — the Impact and Regulatory text are the brief-writer's OWN analysis/opinion and should NOT be fact-checked against the source (they are not claimed to come from the source).

Check specifically:
- Every number, percentage, currency figure, date and named entity in the headline/summary — does the source article support it, or does it differ / is it not mentioned?
- Overall factual alignment — does the brief accurately represent what the source actually reported, without overstating certainty or changing the meaning?

Respond with ONLY a JSON object, no markdown fencing, no commentary outside the JSON:
{
  "verdict": "match" | "discrepancy",
  "summary": "one or two sentence plain-English verdict",
  "details": [ { "field": "e.g. figure: USD44.8 mn", "brief_said": "...", "source_said": "..." } ]
}
"details" should be empty if verdict is "match". Use "discrepancy" only for a REAL mismatch (wrong number, wrong date, fabricated detail) — do not flag paraphrasing, rounding, or the brief adding context the source didn't need to state explicitly.`

export async function runFactCheckForRow(
  row: BriefRow,
  env: { OPENAI_API_KEY?: string; OPENAI_BASE_URL?: string }
): Promise<FactCheckResult> {
  if (!row.source_url) {
    return { verdict: 'unverifiable', summary: 'No source URL recorded for this row — cannot fact-check automatically. Use Source Cross-Check to verify manually.', details: [], fetch_status: 'no_url' }
  }

  const articleText = await fetchArticleText(row.source_url)
  if (!articleText) {
    return {
      verdict: 'unverifiable',
      summary: `Could not fetch the source article (outlet may block automated requests, or it returned a non-text/PDF response). Open the link directly to verify manually: ${row.source_url}`,
      details: [],
      fetch_status: 'fetch_failed',
    }
  }

  if (!env.OPENAI_API_KEY || !env.OPENAI_BASE_URL) {
    return {
      verdict: 'unverifiable',
      summary: 'Source article was fetched successfully, but no LLM API key is configured in this environment to run the comparison.',
      details: [],
      fetch_status: 'ok',
    }
  }

  const briefText = [
    `Headline: ${row.headline}`,
    row.summary ? `Summary: ${row.summary}` : '',
    row.impact_text ? `Impact (brief's own analysis, NOT to be fact-checked against source): ${row.impact_text}` : '',
    row.regulatory_text ? `Regulatory note (brief's own note, NOT to be fact-checked against source): ${row.regulatory_text}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const truncatedArticle = articleText.slice(0, 12000)

  try {
    const res = await fetch(`${env.OPENAI_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `BRIEF TEXT:\n${briefText}\n\nSOURCE ARTICLE (source: ${row.source_name || 'unknown'}, url: ${row.source_url}):\n${truncatedArticle}` },
        ],
        temperature: 0,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return { verdict: 'unverifiable', summary: `LLM comparison call failed (HTTP ${res.status}): ${errText.slice(0, 200)}`, details: [], fetch_status: 'ok' }
    }

    const data = (await res.json()) as any
    const content: string = data?.choices?.[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { verdict: 'unverifiable', summary: `LLM response could not be parsed: ${content.slice(0, 200)}`, details: [], fetch_status: 'ok' }
    }
    const parsed = JSON.parse(jsonMatch[0])
    const verdict: 'match' | 'discrepancy' = parsed.verdict === 'discrepancy' ? 'discrepancy' : 'match'
    return {
      verdict,
      summary: String(parsed.summary || (verdict === 'match' ? 'Figures and wording match the source.' : 'Discrepancies found — see details.')),
      details: Array.isArray(parsed.details) ? parsed.details : [],
      fetch_status: 'ok',
    }
  } catch (err) {
    return { verdict: 'unverifiable', summary: `Fact-check comparison failed: ${err instanceof Error ? err.message : String(err)}`, details: [], fetch_status: 'ok' }
  }
}
