// Redundancy engine — compares a brief's rows against prior briefs' rows to
// catch duplicate/repeated news, per the house rule: "make sure news are not
// redundant from prior weeks" and "no news that is duplicate from last week."
import type { BriefRow, RedundancyMatch } from './types'

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for',
  'with', 'by', 'from', 'up', 'down', 'is', 'was', 'are', 'were', 'be', 'been',
  'has', 'have', 'had', 'its', 'as', 'it', 'this', 'that', 'this week', 'said',
  'after', 'over', 'into', 'amid', 'malaysia', 'malaysian',
])

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

// Jaccard similarity over token sets — cheap, deterministic, good enough for
// "is this the same story" detection without external ML calls.
export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let intersection = 0
  for (const t of setA) if (setB.has(t)) intersection++
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}

export interface RedundancyCandidate {
  row: BriefRow
  priorRow: BriefRow
  similarity: number
  matchType: 'likely_duplicate' | 'continuing_story' | 'similar_topic'
  note: string
}

// Compares each row of the new brief against all rows of prior briefs.
// Thresholds tuned for headline+summary text (English, Malaysian business news):
//   >= 0.55  -> likely_duplicate (same story, same week-on-week figures probably repeated)
//   0.30-0.55 -> continuing_story (same underlying topic, may have moved — acceptable per checklist
//                if the angle genuinely differs, but flagged for human judgement)
//   0.18-0.30 -> similar_topic (weak overlap, informational only)
export function findRedundancy(
  newRows: BriefRow[],
  priorRows: BriefRow[]
): RedundancyCandidate[] {
  const candidates: RedundancyCandidate[] = []

  const priorTokenized = priorRows.map((r) => ({
    row: r,
    tokens: tokenize(`${r.headline} ${r.summary || ''}`),
    entities: safeParseEntities(r.entities),
  }))

  for (const row of newRows) {
    const rowTokens = tokenize(`${row.headline} ${row.summary || ''}`)
    const rowEntities = safeParseEntities(row.entities)

    for (const prior of priorTokenized) {
      const sim = jaccardSimilarity(rowTokens, prior.tokens)
      if (sim < 0.18) continue

      const sharedEntities = rowEntities.filter((e) => prior.entities.includes(e))

      let matchType: RedundancyCandidate['matchType']
      let note: string
      if (sim >= 0.55) {
        matchType = 'likely_duplicate'
        note = `High text overlap (${Math.round(sim * 100)}%) with a row already published in "${prior.row.headline.slice(0, 60)}…" — check whether this is the same story restated rather than a genuinely new development.`
      } else if (sim >= 0.3) {
        matchType = 'continuing_story'
        note = `Moderate overlap (${Math.round(sim * 100)}%) — likely a continuing story (e.g. fuel price update, ongoing negotiation). Acceptable per house rule ONLY if the angle/figures have genuinely moved; confirm before keeping.`
      } else {
        matchType = 'similar_topic'
        note = `Weak topical overlap (${Math.round(sim * 100)}%) — probably unrelated, but shares vocabulary or the same Al Bukhary entity.`
      }

      if (sharedEntities.length > 0) {
        note += ` Shared entities: ${sharedEntities.join(', ')}.`
      }

      candidates.push({
        row,
        priorRow: prior.row,
        similarity: sim,
        matchType,
        note,
      })
    }
  }

  // Keep only the strongest match per new row per prior brief, sorted by similarity desc.
  candidates.sort((a, b) => b.similarity - a.similarity)
  return candidates
}

function safeParseEntities(json: string | null): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function toRedundancyMatchRecord(
  briefId: number,
  candidate: RedundancyCandidate,
  scope: 'cross_week' | 'intra_brief' = 'cross_week'
): Omit<RedundancyMatch, 'id'> & { scope: 'cross_week' | 'intra_brief' } {
  return {
    brief_id: briefId,
    row_id: candidate.row.id,
    prior_brief_id: candidate.priorRow.brief_id,
    prior_row_id: candidate.priorRow.id,
    similarity_score: candidate.similarity,
    match_type: candidate.matchType,
    note: candidate.note,
    scope,
  }
}

// ----------------------------------------------------------------------------
// v3: intra-brief repetition — the SAME edition repeating itself. This is a
// distinct, genuinely new failure mode from cross-week redundancy above, and
// recurred across at least 5 historical editions:
//  - Sec 2 "Structural Macroeconomic Positioning" restating Sec 1/Sec 3 rows
//    almost verbatim (31 Jul #3, 7 Aug #10, 21 Aug #11 — "last week one
//    paragraph was duplicated; this week it is three")
//  - Speed Read bullets restating Executive Summary paragraphs sentence-for-
//    sentence (4 Sep #10: "Bullets 1,3,4,5,7,8,9,10 restate Executive Summary
//    paragraphs 1 to 3"; 21 Aug #10: "Seven of nine Speed Read bullets repeat
//    para 3 sentences almost verbatim")
//  - two rows in the SAME brief (often both in the Pulse table, or two
//    sector rows) ending on the identical channel/sentence (7 Aug #12; 21 Aug
//    #14 "All three cells end on the same channel")
// Threshold is slightly higher than cross-week (0.5) because within a single
// edition some shared vocabulary between adjacent sector rows is expected and
// only near-verbatim repetition is worth flagging.
export function findIntraBriefRepetition(rows: BriefRow[]): RedundancyCandidate[] {
  const candidates: RedundancyCandidate[] = []
  const tokenized = rows.map((r) => ({
    row: r,
    tokens: tokenize(`${r.headline} ${r.summary || ''} ${r.impact_text || ''}`),
  }))

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i]
      const b = tokenized[j]
      if (a.tokens.length < 5 || b.tokens.length < 5) continue // too short to compare meaningfully
      const sim = jaccardSimilarity(a.tokens, b.tokens)
      if (sim < 0.5) continue

      candidates.push({
        row: a.row,
        priorRow: b.row,
        similarity: sim,
        matchType: sim >= 0.65 ? 'likely_duplicate' : 'continuing_story',
        note: `Near-identical text (${Math.round(sim * 100)}% overlap) with another row in THIS SAME edition ("${b.row.headline.slice(0, 60)}…", ${b.row.sector}). Recurring fault: Sec 2 restating Sec 1/3, Speed Read restating the Executive Summary, or two rows sharing one channel sentence — flagged in the 31 Jul, 7 Aug and 21 Aug editions.`,
      })
    }
  }

  candidates.sort((a, b) => b.similarity - a.similarity)
  return candidates
}
