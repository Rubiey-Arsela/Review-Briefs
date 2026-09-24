// Compliance rule engine — encodes the Al Bukhary Weekly Brief house rules.
// v2: upgraded from the earlier Gen Team chat extraction to match the manager's
// full "Updated Master Checklist v2" (source: 20260907 - The Albukhary Group v2.pptx
// briefing pack + the accompanying checklist text supplied with it). Key upgrades
// over v1: (1) multi-tier grading beyond Positive/Negative/Neutral/Mixed —
// Strategic Benchmark / Opportunity Watch / Policy Watch / High Strategic
// Relevance are now valid openers; (2) every Impact must show a visible
// transmission mechanism (the causal chain from the news to the business);
// (3) every Impact must name a specific Al Bukhary business — checked against
// the full ownership map, not just a generic-phrase ban; (4) abbreviations
// (BESS, DCTF, NIF, NRW, WTP, PUE, TBIP, SAC) must be expanded on first use
// across the whole brief.
import type { BriefRow, ComplianceIssue, Entity } from './types'

// --- Rule 16/17: banned / weak vocabulary -----------------------------------
// Never strengthen language beyond the source; avoid filler, hedging and padding.
export const BANNED_WORDS: { word: string; note: string }[] = [
  { word: 'could', note: 'Hedging word — banned. State what is reported, not what might happen.' },
  { word: 'would', note: 'Hedging word — banned.' },
  { word: 'may', note: 'Hedging word — banned (unless directly quoting a source\'s own hedge).' },
  { word: 'about', note: 'Banned filler — use exact figures ("about 5%" → give the precise number).' },
  { word: 'approximately', note: 'Banned filler — use exact figures.' },
  { word: 'support', note: 'Banned generic verb (supports/supporting/supported). Say specifically how.' },
  { word: 'supports', note: 'Banned generic verb. Say specifically how.' },
  { word: 'supporting', note: 'Banned generic verb. Say specifically how.' },
  { word: 'strengthen', note: 'Banned generic verb (strengthens/strengthening) unless quoting a JV partner\'s own language.' },
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
  { word: 'supporting growth', note: 'Generic padding (Rule 17) — delete unless it adds new information.' },
  { word: 'improving competitiveness', note: 'Generic padding unless it adds new information.' },
  { word: 'improves competitiveness', note: 'Generic padding unless it adds new information.' },
  { word: 'intraday', note: 'Do not reference intraday prices/time-of-day — use settlement or official close basis only.' },
]

// --- Rule 11/19: preserve source certainty ----------------------------------
// Never strengthen the source's own level of certainty.
const CERTAINTY_OVERREACH: { weak: string; strong: string }[] = [
  { weak: 'mulls', strong: 'will' },
  { weak: 'considering', strong: 'will' },
  { weak: 'expects', strong: 'will achieve' },
  { weak: 'plans', strong: 'committed' },
  { weak: 'proposed', strong: 'approved' },
  { weak: 'proposes', strong: 'approved' },
  { weak: 'approved', strong: 'secured' },
]

// --- Rule 5/7: grading vocabulary --------------------------------------------
// The brief no longer defaults everything to Positive/Negative/Neutral/Mixed.
// A row's Impact cell must open with exactly ONE of these labels + a full stop.
export const IMPACT_OPENERS = [
  'Positive',
  'Negative',
  'Neutral',
  'Mixed',
  'Strategic Benchmark',
  'Opportunity Watch',
  'Policy Watch',
  'High Strategic Relevance',
]

// Sector-specific known generic entity phrases that must never appear
const GENERIC_ENTITY_PHRASES = ['across the group', 'group companies', 'the group']

// --- Rule 20: abbreviations that must be expanded on first use --------------
export const REQUIRED_ABBREVIATIONS: { abbr: string; full: string }[] = [
  { abbr: 'BESS', full: 'Battery Energy Storage Systems' },
  { abbr: 'DCTF', full: 'Data Centre Task Force' },
  { abbr: 'NIF', full: 'National Investment Framework' },
  { abbr: 'NRW', full: 'Non-Revenue Water' },
  { abbr: 'WTP', full: 'Water Treatment Plant' },
  { abbr: 'PUE', full: 'Power Usage Effectiveness' },
  { abbr: 'TBIP', full: 'Tanjung Bin Industrial Park' },
  { abbr: 'SAC', full: 'Senai Airport City' },
]

// --- Rule 4/9: transmission-mechanism connectors -----------------------------
// A valid causal chain either uses an explicit arrow, or one of these phrases
// that shows how the news reaches the business (cost/margin/demand/timing/etc).
const TRANSMISSION_CONNECTORS = [
  '→', '->', 'leading to', 'resulting in', 'which means', 'translat', 'flows through',
  'as a result', 'in turn', 'thereby', 'pressuring', 'pressures', 'narrowing', 'widening',
  'squeezing', 'raising', 'lowering', 'affects', 'channel', 'benchmark for', 'read-through',
  'implication for', 'exposure to', 'transmission',
]

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

// Rule 5/7: Impact cell must open with exactly one grading label (single or
// multi-word, e.g. "Positive." or "Strategic Benchmark.") followed by a full stop.
export function checkImpactOpener(impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText || !impactText.trim()) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'impact_opener',
      severity: 'error',
      message: `Impact cell is empty — must open with one of: ${IMPACT_OPENERS.join(' / ')}, followed by a full stop.`,
      excerpt: null,
    })
    return issues
  }
  const trimmed = impactText.trim()
  // Up to 4 title-case words before the period, e.g. "High Strategic Relevance."
  const match = trimmed.match(/^([A-Z][a-zA-Z]*(?:\s[A-Z][a-zA-Z]*){0,3})\.\s*/)
  if (!match) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'impact_opener',
      severity: 'error',
      message: `Impact cell does not open with a valid grading label followed by a full stop. Must be one of: ${IMPACT_OPENERS.join(' / ')}.`,
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
      message: `Impact cell opens with "${opener}." — must be exactly one of: ${IMPACT_OPENERS.join(' / ')}.`,
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
        message: `Figure "${match[0].trim()}" in ${fieldName} has no visible "X from Y" comparison base nearby — verify the movement is labelled against a prior figure, with a consistent basis (e.g. don't mix quarter vs. year, or forecast vs. actual).`,
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
        message: `"${strong}" appears in ${fieldName} — confirm the source itself used this level of certainty rather than a weaker term like "${weak}" (mulls ≠ will, expects ≠ will achieve, plans ≠ committed, approved ≠ secured).`,
        excerpt: extractExcerpt(text, strong),
      })
    }
  }
  return issues
}

// Rule 3/9: named-business requirement — flag generic Group references, and check
// entity names against the known Al Bukhary ownership map (associate/JV vs
// wholly-owned subsidiary, known alias traps).
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
        message: `Generic reference "${phrase}" found in ${fieldName} — always name the specific Al Bukhary business instead (e.g. Malakoff, Bernas, Bank Muamalat, MMC Ports).`,
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
          message: `"${alias}" found in ${fieldName} — verify this should be "${entity.name}" (${entity.relationship || 'relationship unknown'}${entity.ownership_pct ? `, ${entity.ownership_pct}%` : ''}${entity.parent_entity ? ` of ${entity.parent_entity}` : ''}).`,
          excerpt: extractExcerpt(text, alias),
        })
      }
    }
    // Associate/JV ownership reminder: if entity mentioned but no % and it IS an
    // associate or JV (i.e. NOT wholly owned), warn once — never imply full control.
    if ((entity.relationship === 'associate' || entity.relationship === 'jv') && entity.ownership_pct) {
      const namePattern = new RegExp(`\\b${escapeRegex(entity.name)}\\b`, 'i')
      if (namePattern.test(text) && !text.includes(String(entity.ownership_pct))) {
        const relLabel = entity.relationship === 'associate' ? 'associate' : 'JV partner interest'
        issues.push({
          brief_id: 0,
          row_id: null,
          rule_code: 'entity_alias',
          severity: 'info',
          message: `${entity.name} is a ${entity.ownership_pct}% ${relLabel}${entity.parent_entity ? ` of ${entity.parent_entity}` : ''} — never refer to it as a wholly-owned subsidiary.`,
          excerpt: extractExcerpt(text, entity.name),
        })
      }
    }
  }
  return issues
}

// Rule 3: every Impact must link to a SPECIFIC Al Bukhary business — not just
// avoid the word "Group", but actually name a real entity from the ownership map.
export function checkEntityLinkage(impactText: string | null, entities: Entity[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText || !impactText.trim()) return issues

  const names: string[] = []
  for (const e of entities) {
    names.push(e.name)
    if (e.aliases) {
      try {
        names.push(...(JSON.parse(e.aliases) as string[]))
      } catch {
        /* ignore */
      }
    }
  }

  const found = names.some((n) => n && new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(impactText))
  if (!found) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'entity_missing_in_impact',
      severity: 'error',
      message: 'Impact does not name a specific Al Bukhary business from the ownership map. Every impact must be linked to a named entity (e.g. "Malakoff", "MMC Ports", "Bank Muamalat") — never left generic.',
      excerpt: impactText.slice(0, 80),
    })
  }
  return issues
}

// Rule 4/9: the Impact must show the transmission mechanism — HOW the news
// reaches the business (the causal chain), not just a bare grade + fact.
export function checkTransmissionMechanism(impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText || !impactText.trim()) return issues
  const lower = impactText.toLowerCase()
  const hasConnector = TRANSMISSION_CONNECTORS.some((c) => lower.includes(c.toLowerCase()))
  if (!hasConnector) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'transmission_mechanism',
      severity: 'warning',
      message: 'No visible transmission mechanism in Impact — show the causal chain from the news to the business (e.g. "Oil ↑ → fuel procurement ↑ → Malakoff generation margins pressured"), not just a restated fact.',
      excerpt: impactText.slice(0, 80),
    })
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

// Rule 12/20: Headline and Summary must be fully aligned — same level of
// certainty, no new information introduced in the Summary. Heuristic: if the
// Headline uses a hedged/proposal verb (mulls, plans, proposes, considers,
// expects) the Summary must not use a stronger decided/completed verb, and
// vice versa.
const HEADLINE_CERTAINTY_TIERS: { tier: 'proposal' | 'decided'; words: string[] }[] = [
  { tier: 'proposal', words: ['mulls', 'considers', 'considering', 'proposes', 'proposed', 'plans', 'planning', 'expects', 'eyes', 'targets', 'weighs'] },
  { tier: 'decided', words: ['approved', 'secures', 'secured', 'commits', 'committed', 'launches', 'launched', 'completes', 'completed', 'signs', 'signed'] },
]

function certaintyTierOf(text: string): 'proposal' | 'decided' | null {
  const lower = text.toLowerCase()
  for (const { tier, words } of HEADLINE_CERTAINTY_TIERS) {
    if (words.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(lower))) return tier
  }
  return null
}

export function checkHeadlineSummaryAlignment(headline: string | null, summary: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!headline || !summary) return issues
  const hTier = certaintyTierOf(headline)
  const sTier = certaintyTierOf(summary)
  if (hTier && sTier && hTier !== sTier) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'headline_summary_mismatch',
      severity: 'warning',
      message: `Headline reads as "${hTier}" but Summary reads as "${sTier}" — Headline and Summary must match the same level of certainty (e.g. if the headline says "mulls", the summary must describe a proposal, not a decision).`,
      excerpt: null,
    })
  }
  return issues
}

// Full row check — runs every per-row rule against one brief_row and returns
// tagged issues. Brief-wide checks (abbreviation first-use) run separately —
// see checkAbbreviationsAcrossBrief below.
export function checkRow(row: Partial<BriefRow>, entities: Entity[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  issues.push(...checkBannedWords(row.headline || '', 'headline'))
  issues.push(...checkBannedWords(row.summary || '', 'summary'))
  issues.push(...checkBannedWords(row.impact_text || '', 'impact'))
  issues.push(...checkBannedWords(row.regulatory_text || '', 'regulatory'))

  issues.push(...checkImpactOpener(row.impact_text || null))
  issues.push(...checkTransmissionMechanism(row.impact_text || null))
  issues.push(...checkEntityLinkage(row.impact_text || null, entities))

  issues.push(...checkXFromY(row.summary || null, 'summary'))
  issues.push(...checkXFromY(row.impact_text || null, 'impact'))

  issues.push(...checkCertaintyOverreach(row.summary || null, 'summary'))
  issues.push(...checkHeadlineSummaryAlignment(row.headline || null, row.summary || null))

  issues.push(...checkEntities(row.headline || '', 'headline', entities))
  issues.push(...checkEntities(row.summary || '', 'summary', entities))
  issues.push(...checkEntities(row.impact_text || '', 'impact', entities))

  issues.push(...checkSourceAttribution(row))

  return issues
}

// Rule 20: abbreviations must be expanded on first use ACROSS THE WHOLE BRIEF
// (not per-row) — e.g. the first time "BESS" appears anywhere in the brief, that
// same row must also contain "Battery Energy Storage Systems". Subsequent uses
// of the abbreviation elsewhere in the brief are fine on their own.
export function checkAbbreviationsAcrossBrief(rows: BriefRow[]): { row_id: number; issue: ComplianceIssue }[] {
  const flagged: { row_id: number; issue: ComplianceIssue }[] = []
  const expanded = new Set<string>()

  const sorted = [...rows].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0))

  for (const row of sorted) {
    const fullText = [row.headline, row.summary, row.impact_text, row.regulatory_text].filter(Boolean).join(' \n ')
    if (!fullText) continue

    for (const { abbr, full } of REQUIRED_ABBREVIATIONS) {
      if (expanded.has(abbr)) continue
      const abbrPattern = new RegExp(`\\b${abbr}\\b`)
      if (!abbrPattern.test(fullText)) continue

      const fullPattern = new RegExp(full.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (fullPattern.test(fullText)) {
        expanded.add(abbr)
      } else {
        flagged.push({
          row_id: row.id,
          issue: {
            brief_id: 0,
            row_id: row.id,
            rule_code: 'abbreviation_expansion',
            severity: 'warning',
            message: `First use of "${abbr}" in this brief should be expanded — write "${full} (${abbr})" on first mention.`,
            excerpt: extractExcerpt(fullText, abbr),
          },
        })
        expanded.add(abbr) // only flag the first occurrence, not every subsequent one
      }
    }
  }

  return flagged
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
