// Shared types for the Maida Vale Brief QA & Continuity Desk

export type Bindings = {
  DB: D1Database
  FILES: R2Bucket
}

export type AppEnv = { Bindings: Bindings }

export interface Brief {
  id: number
  week_label: string
  period_start: string
  period_end: string
  draft_stage: 'draft1' | 'draft2' | 'final'
  title: string | null
  source_filename: string | null
  source_file_type: 'docx' | 'pdf' | 'manual' | null
  r2_key: string | null
  raw_text: string | null
  status: 'uploaded' | 'checked' | 'reviewed'
  created_at: string
  updated_at: string
}

export interface BriefRow {
  id: number
  brief_id: number
  sector: string
  row_order: number
  headline: string
  source_name: string | null
  source_date: string | null
  source_url: string | null
  summary: string | null
  impact_grade: 'Positive' | 'Negative' | 'Neutral' | 'Mixed' | 'Strategic Benchmark' | 'Opportunity Watch' | 'Policy Watch' | 'High Strategic Relevance' | null
  impact_text: string | null
  regulatory_text: string | null
  entities: string | null // JSON array
  created_at: string
}

export interface DailyLogEntry {
  id: number
  log_date: string
  sector: string
  headline: string
  source_name: string | null
  source_url: string | null
  note: string | null
  priority: 'high' | 'normal' | 'watch'
  used_in_brief_id: number | null
  origin: 'auto' | 'manual'
  matched_term: string | null
  created_at: string
}

export interface Entity {
  id: number
  name: string
  sector: string | null
  relationship: 'subsidiary' | 'associate' | 'jv' | 'parent' | null
  ownership_pct: number | null
  parent_entity: string | null
  aliases: string | null // JSON array
  notes: string | null
  created_at: string
}

export interface ComplianceIssue {
  id?: number
  brief_id: number
  row_id: number | null
  rule_code: string
  severity: 'error' | 'warning' | 'info'
  message: string
  excerpt: string | null
}

export interface RedundancyMatch {
  id?: number
  brief_id: number
  row_id: number
  prior_brief_id: number
  prior_row_id: number
  similarity_score: number
  match_type: 'likely_duplicate' | 'continuing_story' | 'similar_topic'
  note: string | null
}

export const SECTORS = [
  'Global',
  'Asia Pacific',
  'Malaysia Macro',
  'Ports/Infrastructure/Logistics',
  'Automotive/Services',
  'Agriculture/Food Security',
  'Energy/Power/Sustainability',
  'Digital Economy/Technology/Data Centres',
  'Property',
  'Aviation',
  'Banking/Financial Services',
  'Watchlist',
  'Speed Read',
  'Other',
] as const

export const NEWS_SOURCES = [
  { name: 'Reuters', domain: 'reuters.com' },
  { name: 'The Star', domain: 'thestar.com.my' },
  { name: 'The Edge', domain: 'theedgemalaysia.com' },
  { name: 'Bernama', domain: 'bernama.com' },
  { name: 'Malay Mail', domain: 'malaymail.com' },
  { name: 'NST', domain: 'nst.com.my' },
  { name: 'The Sun', domain: 'thesundaily.my' },
  { name: 'The Guardian', domain: 'theguardian.com' },
] as const
