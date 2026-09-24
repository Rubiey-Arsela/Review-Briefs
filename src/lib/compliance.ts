// Compliance rule engine — encodes the Team WBR house rules extracted from
// the manager's checklist and recurring review comments.
import type { BriefRow, ComplianceIssue, Entity } from './types'

// --- Rule 16: banned / weak vocabulary --------------------------------------
// Never strengthen language beyond the source; avoid filler and hedging words.
export const BANNED_WORDS: { word: string; note: string }[] = [
  { word: 'could', note: 'Hedging word — banned. State what is reported, not what might happen.' },
  { word: 'would', note: 'Hedging word — banned.' },
  { word: 'may', note: 'Hedging word — banned (unless directly quoting a source\'s own hedge).' },
  { word: 'about', note: 'Banned filler — use exact figures ("about 5%" → give the precise number).' },
  { word: 'approximately', note: 'Banned filler — use exact figures.' },
  { word: 'support', note: 'Banned generic verb (supports/supporting/supported). Say specifically how.' },
  { word: 'supports', note: 'Banned generic verb. Say specifically how.' },
  { word: 'supporting', note: 'Banned generic verb. Say specifically how.' },
  { word: 'strengthen', note: 'Banned generic verb (strengthens/strengthening).' },
  { word: 'strengthens', note: 'Banned generic verb.' },
  { word: 'reinforce', note: 'Banned generic verb (reinforces/reinforcing).' },
  { word: 'reinforces', note: 'Banned generic verb.' },
  { word: 'resilient', note: 'Banned generic adjective — vague, says nothing new.' },
  { word: 'signal', note: 'Banned generic verb (signals/signalling) — prefer "pointed to" or the concrete fact.' },
  { word: 'signals', note: 'Banned generic verb.' },
  { word: 'meanwhile', note: 'Banned connector — vary sentence openings instead.' },
  { word: 'across the group', note: 'Never say "across the Group" — always name the specific Al Bukhary business.' },
  { word: 'group companies', note: 'Never say "Group companies" — name the specific business.' },
  { word: 'creates opportunities', note: 'Generic padding — say what the opportunity specifically is.' },
  { word: 'improving competitiveness', note: 'Generic padding unless it adds new information.' },
  { word: 'intraday', note: 'Do not reference intraday prices/time-of-day — use settlement or official close basis only.' },
]

// --- Rule 12/11: preserve source certainty ----------------------------------
// Never strengthen the source's own level of certainty.
const CERTAINTY_OVERREACH: { weak: string; strong: string }[] = [
  { weak: 'mulls', strong: 'will' },
  { weak: 'considering', strong: 'will' },
  { weak: 'expects', strong: 'will achieve' },
  { weak: 'plans', strong: 'committed' },
  { weak: 'proposed', strong: 'approved' },
  { weak: 'approved', strong: 'secured' },
]

const IMPACT_OPENERS = ['Positive', 'Negative', 'Neutral', 'Mixed']

// Sector-specific known generic entity phrases that must never appear
const GENERIC_ENTITY_PHRASES = ['across the group', 'group companies', 'the group']

export function checkBannedWords(text: string, source: 'headline' | 'summary' | 'impact' | 'regulatory'): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  const lower = text.toLowerCase()
  for (const { word, note } of BANNED_WORDS) {
    // word-boundary match to avoid false positives (e.g. "may" inside "Malaysia")
    const pattern = new RegExp(`\\b${escapeRegex(word)}\\b`, 'i')
    if (pattern.test(lower)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'banned_word',
        severity: 'error',
        message: `Banned word "${word}" found in ${source}. ${note}`,
        excerpt: extractExcerpt(text, word),
      })
    }
  }
  return issues
}

// Rule: Impact cell must open with exactly one grading word followed by a full stop.
export function checkImpactOpener(impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText || !impactText.trim()) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'impact_opener',
      severity: 'error',
      message: 'Impact cell is empty — must open with Positive/Negative/Neutral/Mixed followed by a full stop.',
      excerpt: null,
    })
    return issues
  }
  const trimmed = impactText.trim()
  const match = trimmed.match(/^([A-Za-z]+)\.\s*/)
  if (!match) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'impact_opener',
      severity: 'error',
      message: 'Impact cell does not open with a single grading word followed by a full stop.',
      excerpt: trimmed.slice(0, 60),
    })
    return issues
  }
  const opener = match[1]
  if (!IMPACT_OPENERS.includes(opener)) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'impact_opener',
      severity: 'error',
      message: `Impact cell opens with "${opener}." — must be exactly one of Positive / Negative / Neutral / Mixed. Labels like "Strategic benchmark" or "Opportunity watch" go in the prose, not as the opener.`,
      excerpt: trimmed.slice(0, 60),
    })
  }
  return issues
}

// Rule 9/10: every movement/comparison must be written as "X from Y" with a labelled basis.
// Heuristic: find numeric/percentage figures in text; if a figure appears without a nearby
// "from" within ~40 chars, flag it as a possible missing comparison base.
export function checkXFromY(text: string | null, fieldName: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  // Matches numbers with % or common units (bn, mn, USD, RM, sen, bps, pts)
  const figureRegex = /\b\d[\d,]*\.?\d*\s?(%|percent|bn|mn|bil|mil|bps|pts|sen)\b/gi
  let match: RegExpExecArray | null
  while ((match = figureRegex.exec(text)) !== null) {
    const idx = match.index
    const windowText = text.slice(Math.max(0, idx - 10), Math.min(text.length, idx + match[0].length + 45))
    if (!/\bfrom\b/i.test(windowText)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'x_from_y',
        severity: 'warning',
        message: `Figure "${match[0].trim()}" in ${fieldName} has no visible "X from Y" comparison base nearby — verify the movement is labelled against a prior figure.`,
        excerpt: windowText.trim(),
      })
    }
  }
  return issues
}

// Rule: preserve source certainty — flag common overreach substitutions.
export function checkCertaintyOverreach(text: string | null, fieldName: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  const lower = text.toLowerCase()
  for (const { weak, strong } of CERTAINTY_OVERREACH) {
    if (lower.includes(strong) && !lower.includes(weak)) {
      // Only a soft signal — cannot know the source's original wording, so info-level only.
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'weak_language',
        severity: 'info',
        message: `"${strong}" appears in ${fieldName} — confirm the source itself used this level of certainty rather than a weaker term like "${weak}".`,
        excerpt: extractExcerpt(text, strong),
      })
    }
  }
  return issues
}

// Rule 3/9: named-business requirement — flag generic Group references, and check
// entity names against the known Al Bukhary ownership map (associate vs subsidiary,
// known alias traps).
export function checkEntities(text: string | null, fieldName: string, entities: Entity[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  const lower = text.toLowerCase()

  for (const phrase of GENERIC_ENTITY_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'entity_generic',
        severity: 'error',
        message: `Generic reference "${phrase}" found in ${fieldName} — always name the specific Al Bukhary business instead.`,
        excerpt: extractExcerpt(text, phrase),
      })
    }
  }

  for (const entity of entities) {
    if (!entity.aliases) continue
    let aliases: string[] = []
    try {
      aliases = JSON.parse(entity.aliases)
    } catch {
      aliases = []
    }
    for (const alias of aliases) {
      const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i')
      if (pattern.test(text)) {
        issues.push({
          brief_id: 0,
          row_id: null,
          rule_code: 'entity_alias',
          severity: 'warning',
          message: `"${alias}" found in ${fieldName} — verify this should be "${entity.name}" (${entity.relationship || 'relationship unknown'}${entity.ownership_pct ? `, ${entity.ownership_pct}%` : ''}).`,
          excerpt: extractExcerpt(text, alias),
        })
      }
    }
    // Associate/JV ownership reminder: if entity mentioned but no % and it IS an associate, warn once.
    if (entity.relationship === 'associate' && entity.ownership_pct) {
      const namePattern = new RegExp(`\\b${escapeRegex(entity.name)}\\b`, 'i')
      if (namePattern.test(text) && !text.includes(String(entity.ownership_pct))) {
        issues.push({
          brief_id: 0,
          row_id: null,
          rule_code: 'entity_alias',
          severity: 'info',
          message: `${entity.name} is a ${entity.ownership_pct}% associate of ${entity.parent_entity} — never refer to it as a wholly-owned subsidiary.`,
          excerpt: extractExcerpt(text, entity.name),
        })
      }
    }
  }
  return issues
}

// Rule: headline & source must be present.
export function checkSourceAttribution(row: Partial<BriefRow>): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!row.source_name || !row.source_name.trim()) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'no_source',
      severity: 'error',
      message: 'No source outlet attributed to this headline.',
      excerpt: row.headline || null,
    })
  }
  if (!row.source_date || !row.source_date.trim()) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'no_source',
      severity: 'warning',
      message: 'No date attributed to this headline — dates must be checked against the reporting window.',
      excerpt: row.headline || null,
    })
  }
  return issues
}

// Full row check — runs every rule against one brief_row and returns tagged issues.
export function checkRow(row: Partial<BriefRow>, entities: Entity[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  issues.push(...checkBannedWords(row.headline || '', 'headline'))
  issues.push(...checkBannedWords(row.summary || '', 'summary'))
  issues.push(...checkBannedWords(row.impact_text || '', 'impact'))
  issues.push(...checkBannedWords(row.regulatory_text || '', 'regulatory'))

  issues.push(...checkImpactOpener(row.impact_text || null))

  issues.push(...checkXFromY(row.summary || null, 'summary'))
  issues.push(...checkXFromY(row.impact_text || null, 'impact'))

  issues.push(...checkCertaintyOverreach(row.summary || null, 'summary'))

  issues.push(...checkEntities(row.headline || '', 'headline', entities))
  issues.push(...checkEntities(row.summary || '', 'summary', entities))
  issues.push(...checkEntities(row.impact_text || '', 'impact', entities))

  issues.push(...checkSourceAttribution(row))

  return issues
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractExcerpt(text: string, term: string): string {
  const idx = text.toLowerCase().indexOf(term.toLowerCase())
  if (idx === -1) return text.slice(0, 60)
  const start = Math.max(0, idx - 25)
  const end = Math.min(text.length, idx + term.length + 25)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}
