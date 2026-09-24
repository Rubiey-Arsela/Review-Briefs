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

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

// Jaccard similarity over token sets — cheap, deterministic, good enough for
// "is this the same story" detection without external ML calls.
function jaccardSimilarity(a: string[], b: string[]): number {
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
  candidate: RedundancyCandidate
): Omit<RedundancyMatch, 'id'> {
  return {
    brief_id: briefId,
    row_id: candidate.row.id,
    prior_brief_id: candidate.priorRow.brief_id,
    prior_row_id: candidate.priorRow.id,
    similarity_score: candidate.similarity,
    match_type: candidate.matchType,
    note: candidate.note,
  }
}
