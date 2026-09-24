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
//
// v3: mined from 10 real director/manager change-log editions of the actual
// weekly brief (24 Jul 2026 - 11 Sep 2026), per instruction: "make sure review
// and don't repeat same mistakes every week." New rule families added below,
// each annotated with which edition(s) it recurred in:
//  - "relevant to X" bolted-on connector phrase (31 Jul, 7 Aug, 21 Aug, 4 Sep)
//  - naming an entity then denying a Group channel in the same cell (7 Aug #1)
//  - Regulatory column restating Summary/Impact almost verbatim (24 Jul #20,
//    31 Jul C9, 4 Sep #35/48)
//  - generic/unnamed attribution — "analysts expect", "industry leaders urged"
//    with no named research house or forum (6 Aug B8, 7 Aug #26, 11 Sep #24)
//  - source attribution leaking into the Impact cell instead of the Summary
//    (7 Aug #16)
//  - Impact grade contradicted by the cell's own sentiment / graded from the
//    wrong party's point of view (24 Jul #11/#12, 27-31 Jul A4)
//  - a much longer list of abbreviations that recurred unexpanded (27-31 Jul
//    B10, 7 Aug #19/#23/#27, 21 Aug #24/#27, 11 Sep #13)
// v4: two house-style conflicts flagged in v3 as needing a director decision
// have now been RESOLVED per the director's explicit 24 Sep 2026 ruling:
//  (1) Impact grade format — the 4 Sep 2026 change log (item 24) ruling by
//      Syazwan ("plain single word, no qualifiers") is confirmed as the
//      standing house style, OVERRIDING the 8-tier system introduced in the
//      7 Sep 2026 PPTX checklist v2. IMPACT_OPENERS is back to the 4 plain
//      grades and the opener regex only accepts a single word.
//  (2) Currency-code spacing — the 11 Sep 2026 change log (item 1) "no space
//      between currency code and figure" ruling (e.g. "RM170.5 bn", not
//      "RM 170.5 bn") is confirmed as current house style, reversing all
//      earlier editions. See checkCurrencySpacing() below.
// Remaining unresolved conflicts (blank Regulatory cell style; compound grade
// labels) are unaffected — see README "Known house-style conflicts".
import type { BriefRow, ComplianceIssue, Entity } from './types'
import { tokenize, jaccardSimilarity } from './redundancy'

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
  // --- v3 additions, mined from historical change logs ------------------
  { word: 'relevant to', note: 'Banned bolted-on connector (recurred across the 31 Jul, 7 Aug, 21 Aug and 4 Sep editions despite repeated correction). Replace with the actual transmission channel, or drop the link entirely if there is no real one.' },
  { word: 'with implications for', note: 'Banned vague closer — always state the direction (positive/negative) and the mechanism, not just that "implications" exist.' },
  { word: 'despite external uncertainties', note: 'Banned trailing filler — cut; it adds no information (flagged 31 Jul C13).' },
  { word: 'highlighting supply chain risks', note: 'Banned trailing filler/padding — cut unless a specific new risk is named (flagged 31 Jul C13).' },
  { word: 'reinforcing', note: 'Banned generic verb — same family as reinforce/reinforces.' },
  { word: 'validate', note: 'Banned generic verb (validates/validating) — say specifically what changed, not that something abstract was "validated".' },
  { word: 'validates', note: 'Banned generic verb.' },
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
]

// Sector-specific known generic entity phrases that must never appear
const GENERIC_ENTITY_PHRASES = ['across the group', 'group companies', 'the group']

// --- Rule 20: abbreviations that must be expanded on first use --------------
// Base set from the Sept 2026 PPTX checklist v2, plus a long tail mined from
// the 10 historical change logs — every one of these was flagged UNEXPANDED
// in at least one real edition (citations in the comment column). Lower-case
// 3-4 letter movement abbreviations (mom/yoy/wow/qoq) are handled separately
// by checkMovementAbbreviations() below since they are case-insensitive and
// far more frequent than a per-brief "first use" tracker suits.
export const REQUIRED_ABBREVIATIONS: { abbr: string; full: string }[] = [
  { abbr: 'BESS', full: 'Battery Energy Storage Systems' },
  { abbr: 'DCTF', full: 'Data Centre Task Force' },
  { abbr: 'NIF', full: 'National Investment Framework' },
  { abbr: 'NRW', full: 'Non-Revenue Water' },
  { abbr: 'WTP', full: 'Water Treatment Plant' },
  { abbr: 'PUE', full: 'Power Usage Effectiveness' },
  { abbr: 'TBIP', full: 'Tanjung Bin Industrial Park' },
  { abbr: 'SAC', full: 'Senai Airport City' },
  // v3 additions — each flagged unexpanded in a real edition:
  { abbr: 'TIV', full: 'total industry volume' },               // 27-31 Jul B10, 21 Aug #24
  { abbr: 'xEV', full: 'electrified vehicle' },                 // 27-31 Jul B10
  { abbr: 'TNB', full: 'Tenaga Nasional Berhad' },               // 27-31 Jul B10
  { abbr: 'MITI', full: 'Ministry of Investment, Trade and Industry' }, // 27-31 Jul B10
  { abbr: 'AMRO', full: 'ASEAN+3 Macroeconomic Research Office' }, // 27-31 Jul B10
  { abbr: 'GM32', full: 'Gas Malaysia\u2019s GM32 Transformation Programme' }, // 21 Aug #24
  { abbr: 'PETRA', full: 'Ministry of Natural Resources and Environmental Sustainability' }, // 7 Aug #27
  { abbr: 'AIRB', full: 'Aliran Ihsan Resources Berhad' },       // 7 Aug #27
  { abbr: 'MNRB', full: 'MNRB Holdings Berhad' },                // 7 Aug #27
  { abbr: 'CAAM', full: 'Civil Aviation Authority of Malaysia' }, // 7 Aug #23/#27
  { abbr: 'PDRM', full: 'Royal Malaysia Police' },               // 7 Aug #23/#27
  { abbr: 'AVSEC', full: 'aviation security' },                  // 7 Aug #27
  { abbr: 'MEP', full: 'mechanical, electrical and plumbing' },  // 7 Aug #27, 4 Sep #64
  { abbr: 'FMM', full: 'Federation of Malaysian Manufacturers' }, // 4 Sep #14
  { abbr: 'GDV', full: 'Gross Development Value' },              // 21 Aug #26
  { abbr: 'NAFAS', full: 'National Farmers\u2019 Organisation' }, // 4 Sep #60
  { abbr: 'MIDA', full: 'Malaysian Investment Development Authority' }, // 11 Sep #13
  { abbr: 'MPOB', full: 'Malaysian Palm Oil Board' },            // 11 Sep #13
  { abbr: 'BNM', full: 'Bank Negara Malaysia' },                 // 11 Sep #13
  { abbr: 'SOFR', full: 'Secured Overnight Financing Rate' },    // 11 Sep #13
  { abbr: 'TEU', full: 'twenty-foot equivalent unit' },          // 11 Sep #13, #25
  { abbr: 'LNG', full: 'liquefied natural gas' },                // 11 Sep #12
  { abbr: 'E&E', full: 'electrical and electronics' },           // 21 Aug #22
  { abbr: 'AI', full: 'artificial intelligence' },                // 11 Sep #13
]

// Rule: movement/period-on-period abbreviations must be expanded on first use.
// Case-insensitive and checked once per brief regardless of column, since these
// appear dozens of times per edition (mom/yoy/wow/qoq) — flagged unexpanded in
// the 6 Aug (#13) and 21 Aug (#24) editions.
const MOVEMENT_ABBREVIATIONS: { abbr: string; full: string }[] = [
  { abbr: 'yoy', full: 'year-on-year' },
  { abbr: 'mom', full: 'month-on-month' },
  { abbr: 'wow', full: 'week-on-week' },
  { abbr: 'qoq', full: 'quarter-on-quarter' },
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

// Rule 5/7: Impact cell must open with exactly one plain single-word grading
// label (e.g. "Positive.") followed by a full stop — no qualifiers attached
// to the label (per Syazwan's 4 Sep 2026 ruling, item 24).
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
  // Single title-case word before the period only — no qualifiers (4 Sep 2026 ruling).
  const match = trimmed.match(/^([A-Z][a-zA-Z]*)\.\s*/)
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

// ============================================================================
// v3 rules — mined from 10 historical director/manager change-log editions.
// ============================================================================

// Rule (v3): an Impact cell must not name a specific Al Bukhary business and
// then, in the same breath, deny any Group link to it. This exact mistake was
// called out by name in the 7 Aug edition (#1): "...relevant to Malakoff, but
// there is no direct Group channel at present." — the cell contradicts itself.
const DENIAL_PHRASES = [
  'no direct group channel', 'no group channel', 'not disclosed in the syndicate',
  'no disclosed direct', 'no direct al bukhary exposure', 'no group exposure',
  'no group company is currently named', 'no group participation',
]
export function checkEntityThenDenial(impactText: string | null, entities: Entity[]): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText || !impactText.trim()) return issues
  const lower = impactText.toLowerCase()
  const hasDenial = DENIAL_PHRASES.some((p) => lower.includes(p))
  if (!hasDenial) return issues

  const names: string[] = []
  for (const e of entities) {
    names.push(e.name)
    if (e.aliases) {
      try { names.push(...(JSON.parse(e.aliases) as string[])) } catch { /* ignore */ }
    }
  }
  const namedEntity = names.find((n) => n && new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(impactText))
  if (namedEntity) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'entity_named_then_denied',
      severity: 'error',
      message: `Impact names "${namedEntity}" but then denies a Group channel in the same cell — this exact contradiction was flagged in the 7 Aug 2026 edition. Either keep the read-across and delete the disclaimer, or delete the entity name and grade on sector news alone.`,
      excerpt: extractExcerpt(impactText, namedEntity),
    })
  }
  return issues
}

// Rule (v3): the Regulatory/Policy cell must add NEW information — the actual
// regulatory mechanism or a policy change — not restate what the Summary or
// Impact cell already said, and not carry a "monitoring note" that is not
// itself a policy change. Flagged repeatedly: 24 Jul #20, 31 Jul C9, 7 Aug #1,
// 4 Sep #35/#48.
const REGULATORY_RESTATEMENT_PHRASES = [
  'not a policy decision', 'not a confirmed decision', 'no scope, investment or timetable',
  'no measures are in force', 'remains a market expectation',
]
export function checkRegulatoryRestatesOther(regulatoryText: string | null, summaryText: string | null, impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!regulatoryText || !regulatoryText.trim() || regulatoryText.trim() === '-' || regulatoryText.trim() === '\u2013') return issues
  const regTokens = tokenize(regulatoryText)
  if (regTokens.length >= 5) {
    for (const [label, other] of [['summary', summaryText], ['impact', impactText]] as const) {
      if (!other) continue
      const sim = jaccardSimilarity(regTokens, tokenize(other))
      if (sim >= 0.5) {
        issues.push({
          brief_id: 0,
          row_id: null,
          rule_code: 'regulatory_restates_other',
          severity: 'warning',
          message: `Regulatory cell largely restates the ${label} cell (${Math.round(sim * 100)}% word overlap) instead of stating the actual regulatory mechanism or policy change. Fill with the real mechanism or dash the cell — this was flagged in the 24 Jul, 31 Jul and 4 Sep editions.`,
          excerpt: regulatoryText.slice(0, 80),
        })
      }
    }
  }
  const lower = regulatoryText.toLowerCase()
  for (const phrase of REGULATORY_RESTATEMENT_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'regulatory_restates_other',
        severity: 'info',
        message: `Regulatory cell carries a monitoring/disclaimer note ("${phrase}") rather than an actual policy change — confirm this is deliberate.`,
        excerpt: extractExcerpt(regulatoryText, phrase),
      })
    }
  }
  return issues
}

// Rule (v3): claims of the form "analysts expect...", "research houses cited
// expect...", "industry leaders urged..." must name the specific research
// house / forum / speaker. Flagged in 6 Aug (B8) and 7 Aug (#26 — Speed Read
// dropped Phillip Capital's attribution) and echoed in 11 Sep (#24).
const UNNAMED_ATTRIBUTION_PHRASES = [
  'analysts expect', 'analysts said', 'industry leaders urged', 'research houses expect',
  'sources said', 'experts say', 'experts believe', 'market watchers',
]
export function checkUnnamedAttribution(text: string | null, fieldName: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  const lower = text.toLowerCase()
  for (const phrase of UNNAMED_ATTRIBUTION_PHRASES) {
    if (lower.includes(phrase)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'unnamed_attribution',
        severity: 'warning',
        message: `"${phrase}" in ${fieldName} has no named source — name the specific research house, analyst, forum or speaker (e.g. "RHB Research", "Phillip Capital"). Recurred in the 6 Aug and 7 Aug editions.`,
        excerpt: extractExcerpt(text, phrase),
      })
    }
  }
  return issues
}

// Rule (v3): a wire-service attribution phrase ("according to sources",
// "Reuters noted that...") belongs in the Summary, not the Impact cell — the
// Impact column is the Group's own read, not a restatement of the wire's
// hedge. Flagged 7 Aug (#16) and 4 Sep (#66).
const WIRE_ATTRIBUTION_IN_IMPACT = ['according to sources', 'reuters noted', 'sources said', 'the wire reported']
export function checkSourceLeaksIntoImpact(impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactText) return issues
  const lower = impactText.toLowerCase()
  for (const phrase of WIRE_ATTRIBUTION_IN_IMPACT) {
    if (lower.includes(phrase)) {
      issues.push({
        brief_id: 0,
        row_id: null,
        rule_code: 'source_in_impact',
        severity: 'warning',
        message: `Wire-attribution phrase "${phrase}" found in Impact — move it to the Summary. The Impact column is the Group's own read, not the wire's hedge (flagged 7 Aug #16, 4 Sep #66).`,
        excerpt: extractExcerpt(impactText, phrase),
      })
    }
  }
  return issues
}

// Rule (v3): a row's Impact grade must be consistent with which side of the
// transaction/story the Al Bukhary business sits on. Classic failure mode
// (24 Jul #11/#12): a competitor's strengthening move is graded Positive
// because the sentence is upbeat in isolation, when in fact it describes a
// competitive THREAT to the Group and should be Negative/Neutral. Heuristic:
// if the Impact opens Positive/Strategic-tier but the same cell also contains
// a competitive-threat phrase naming a competitor gaining ground, flag for
// human check — this cannot be fully automated, so it is an info-level nudge.
const COMPETITIVE_THREAT_PHRASES = [
  'intensifying competition', 'competing for', 'competitor', 'competing against',
  'outperform the broader market', 'strengthens its position against',
]
export function checkGradePerspective(impactGrade: string | null, impactText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!impactGrade || !impactText) return issues
  const positiveTiers = ['Positive']
  if (!positiveTiers.includes(impactGrade)) return issues
  const lower = impactText.toLowerCase()
  const hasThreat = COMPETITIVE_THREAT_PHRASES.some((p) => lower.includes(p))
  if (hasThreat) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'grade_perspective',
      severity: 'info',
      message: `Impact is graded "${impactGrade}" but the text describes a competitor gaining ground — confirm the grade is read from the Al Bukhary Group's position, not the subject company's. This exact fault (grading from the wrong party's chair) was flagged twice in the 24 Jul edition (#11, #12).`,
      excerpt: impactText.slice(0, 80),
    })
  }
  return issues
}

// Rule (v3): flag stated figure movements where two different comparison
// bases might be mixed (e.g. a single month vs a full year, or a forecast vs
// an actual) — heuristic companion to checkXFromY. Historical instances: 24
// Jul #40 (single-month FX average vs full-year average), 6 Aug (missing
// no-repetition baseline). This heuristic looks for a figure followed by
// "as of <month>" or a specific month name near another figure qualified
// "in <year>" without a matching month — genuinely hard to detect reliably,
// so kept as info-level only.
export function checkMovementAbbreviations(rows: BriefRow[]): { row_id: number; issue: ComplianceIssue }[] {
  const flagged: { row_id: number; issue: ComplianceIssue }[] = []
  const expandedAnywhere = new Set<string>()
  const sorted = [...rows].sort((a, b) => (a.row_order ?? 0) - (b.row_order ?? 0))

  // First pass: does the brief expand any of these anywhere at all?
  for (const row of sorted) {
    const fullText = [row.headline, row.summary, row.impact_text, row.regulatory_text].filter(Boolean).join(' \n ')
    for (const { abbr, full } of MOVEMENT_ABBREVIATIONS) {
      if (new RegExp(full.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'), 'i').test(fullText)) {
        expandedAnywhere.add(abbr)
      }
    }
  }

  for (const { abbr, full } of MOVEMENT_ABBREVIATIONS) {
    if (expandedAnywhere.has(abbr)) continue
    // Find the first row that uses it, to attach the flag somewhere useful.
    for (const row of sorted) {
      const fullText = [row.headline, row.summary, row.impact_text, row.regulatory_text].filter(Boolean).join(' \n ')
      if (new RegExp(`\\b${abbr}\\b`, 'i').test(fullText)) {
        flagged.push({
          row_id: row.id,
          issue: {
            brief_id: 0,
            row_id: row.id,
            rule_code: 'abbreviation_expansion',
            severity: 'info',
            message: `"${abbr}" is used throughout the brief but never expanded once — add a first-use gloss, e.g. "${full} (${abbr})" (flagged in the 6 Aug and 21 Aug editions).`,
            excerpt: extractExcerpt(fullText, abbr),
          },
        })
        break
      }
    }
  }
  return flagged
}

// Rule (v3): the Regulatory/Policy cell should never be a bare dash/blank —
// house style (per the 6 Aug review, item 3) is the standard boilerplate
// sentence. Checked separately from checkRegulatoryRestatesOther because an
// EMPTY cell and a cell that MERELY RESTATES are different failure modes.
export function checkRegulatoryBoilerplate(regulatoryText: string | null): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  const trimmed = (regulatoryText || '').trim()
  if (trimmed === '' || trimmed === '-' || trimmed === '\u2013' || trimmed === '\u2014') {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'regulatory_boilerplate',
      severity: 'info',
      message: 'Regulatory/Policy cell is a bare dash — house style (6 Aug review, item 3) is the standard sentence "No new regulatory or policy changes were introduced." rather than a dash.',
      excerpt: null,
    })
  }
  return issues
}

// Rule (v4, resolved conflict #2): a currency code must have NO space before
// the figure — "RM170.5 bn", "USD104.35" — per the 11 Sep 2026 change log
// (item 1), which reverses the "RM 170.5 bn" (with space) style used in all
// earlier editions. The space before the unit (bn/mn/tn/per barrel etc.) is
// retained — only the space between the currency code and the number itself
// is banned.
export function checkCurrencySpacing(text: string | null, fieldName: string): ComplianceIssue[] {
  const issues: ComplianceIssue[] = []
  if (!text) return issues
  const pattern = /\b(RM|USD)\s+(\d[\d,]*\.?\d*)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    issues.push({
      brief_id: 0,
      row_id: null,
      rule_code: 'currency_spacing',
      severity: 'warning',
      message: `"${match[0]}" has a space between the currency code and the figure — house style (11 Sep 2026 ruling) is no space: "${match[1]}${match[2]}". The space before the unit (bn/mn/tn) is kept.`,
      excerpt: extractExcerpt(text, match[0]),
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

  // v3 additions
  issues.push(...checkEntityThenDenial(row.impact_text || null, entities))
  issues.push(...checkRegulatoryRestatesOther(row.regulatory_text || null, row.summary || null, row.impact_text || null))
  issues.push(...checkRegulatoryBoilerplate(row.regulatory_text || null))
  issues.push(...checkUnnamedAttribution(row.summary || null, 'summary'))
  issues.push(...checkUnnamedAttribution(row.impact_text || null, 'impact'))
  issues.push(...checkSourceLeaksIntoImpact(row.impact_text || null))
  issues.push(...checkGradePerspective(row.impact_grade || null, row.impact_text || null))

  issues.push(...checkEntities(row.headline || '', 'headline', entities))
  issues.push(...checkEntities(row.summary || '', 'summary', entities))
  issues.push(...checkEntities(row.impact_text || '', 'impact', entities))

  issues.push(...checkSourceAttribution(row))

  // v4 additions (resolved conflict #2)
  issues.push(...checkCurrencySpacing(row.headline || null, 'headline'))
  issues.push(...checkCurrencySpacing(row.summary || null, 'summary'))
  issues.push(...checkCurrencySpacing(row.impact_text || null, 'impact'))
  issues.push(...checkCurrencySpacing(row.regulatory_text || null, 'regulatory'))

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
