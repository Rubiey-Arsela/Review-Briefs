import { Hono } from 'hono'
import type { AppEnv, Brief, BriefRow, Entity } from '../lib/types'
import { checkRow, checkAbbreviationsAcrossBrief, checkMovementAbbreviations, fingerprintIssue } from '../lib/compliance'
import { findRedundancy, findIntraBriefRepetition, toRedundancyMatchRecord } from '../lib/redundancy'
import { runFactCheckForRow } from '../lib/factcheck'

const briefs = new Hono<AppEnv>()

// ---------------------------------------------------------------------------
// GET /api/briefs — list all briefs (weeks), most recent first, with row counts
// ---------------------------------------------------------------------------
briefs.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.*,
            (SELECT COUNT(*) FROM brief_rows r WHERE r.brief_id = b.id) as row_count,
            (SELECT COUNT(*) FROM compliance_issues ci WHERE ci.brief_id = b.id AND ci.severity = 'error') as error_count,
            (SELECT COUNT(*) FROM compliance_issues ci WHERE ci.brief_id = b.id AND ci.severity = 'warning') as warning_count,
            (SELECT COUNT(*) FROM redundancy_matches rm WHERE rm.brief_id = b.id AND rm.match_type = 'likely_duplicate') as duplicate_count
     FROM briefs b
     ORDER BY b.period_start DESC, b.draft_stage DESC, b.created_at DESC`
  ).all()
  return c.json({ briefs: results })
})

// ---------------------------------------------------------------------------
// GET /api/briefs/:id — full detail: brief + rows
// ---------------------------------------------------------------------------
briefs.get('/:id', async (c) => {
  const id = c.req.param('id')
  const brief = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!brief) return c.json({ error: 'Brief not found' }, 404)

  const { results: rows } = await c.env.DB.prepare(
    'SELECT * FROM brief_rows WHERE brief_id = ? ORDER BY row_order ASC, id ASC'
  ).bind(id).all<BriefRow>()

  return c.json({ brief, rows })
})

// ---------------------------------------------------------------------------
// POST /api/briefs — create a new brief (upload) with metadata + parsed rows
// Body: { week_label, period_start, period_end, draft_stage, title,
//         source_filename, source_file_type, raw_text, rows: [...] }
// ---------------------------------------------------------------------------
briefs.post('/', async (c) => {
  const body = await c.req.json<{
    week_label: string
    period_start: string
    period_end: string
    draft_stage?: string
    title?: string
    source_filename?: string
    source_file_type?: string
    raw_text?: string
    rows?: Partial<BriefRow>[]
  }>()

  if (!body.week_label || !body.period_start || !body.period_end) {
    return c.json({ error: 'week_label, period_start and period_end are required' }, 400)
  }

  const insertBrief = await c.env.DB.prepare(
    `INSERT INTO briefs (week_label, period_start, period_end, draft_stage, title, source_filename, source_file_type, raw_text, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')`
  )
    .bind(
      body.week_label,
      body.period_start,
      body.period_end,
      body.draft_stage || 'draft1',
      body.title || body.week_label,
      body.source_filename || null,
      body.source_file_type || 'manual',
      body.raw_text || null
    )
    .run()

  const briefId = insertBrief.meta.last_row_id as number

  if (body.rows && body.rows.length > 0) {
    let order = 0
    for (const row of body.rows) {
      await insertRow(c.env.DB, briefId, row, order++)
    }
  }

  return c.json({ id: briefId }, 201)
})

// ---------------------------------------------------------------------------
// PUT /api/briefs/:id — update brief metadata (week label, dates, stage, title)
// ---------------------------------------------------------------------------
briefs.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Partial<Brief>>()

  const existing = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!existing) return c.json({ error: 'Brief not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE briefs SET week_label = ?, period_start = ?, period_end = ?, draft_stage = ?, title = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.week_label ?? existing.week_label,
      body.period_start ?? existing.period_start,
      body.period_end ?? existing.period_end,
      body.draft_stage ?? existing.draft_stage,
      body.title ?? existing.title,
      body.status ?? existing.status,
      id
    )
    .run()

  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// DELETE /api/briefs/:id — delete a brief and cascade its rows/issues/matches
// ---------------------------------------------------------------------------
briefs.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!existing) return c.json({ error: 'Brief not found' }, 404)

  // Clean up the original file in R2 if present
  if (existing.r2_key) {
    try {
      await c.env.FILES.delete(existing.r2_key)
    } catch {
      // non-fatal
    }
  }

  await c.env.DB.prepare('DELETE FROM briefs WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/briefs/:id/file — upload original docx/pdf to R2 for this brief
// Accepts multipart/form-data with field "file"
// ---------------------------------------------------------------------------
briefs.post('/:id/file', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!existing) return c.json({ error: 'Brief not found' }, 404)

  const form = await c.req.formData()
  const file = form.get('file') as File | null
  if (!file) return c.json({ error: 'No file provided' }, 400)

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const key = `briefs/${id}/${Date.now()}-${sanitizeFilename(file.name)}`

  const buf = await file.arrayBuffer()
  await c.env.FILES.put(key, buf, {
    httpMetadata: { contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream') },
  })

  await c.env.DB.prepare(
    `UPDATE briefs SET r2_key = ?, source_filename = ?, source_file_type = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(key, file.name, ext === 'pdf' ? 'pdf' : 'docx', id)
    .run()

  return c.json({ ok: true, r2_key: key })
})

// ---------------------------------------------------------------------------
// GET /api/briefs/:id/file — download the original file from R2
// ---------------------------------------------------------------------------
briefs.get('/:id/file', async (c) => {
  const id = c.req.param('id')
  const existing = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!existing || !existing.r2_key) return c.json({ error: 'No file for this brief' }, 404)

  const obj = await c.env.FILES.get(existing.r2_key)
  if (!obj) return c.json({ error: 'File missing from storage' }, 404)

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${existing.source_filename || 'brief'}"`,
    },
  })
})

// ---------------------------------------------------------------------------
// PUT /api/briefs/:id/rows — replace all rows for a brief (bulk re-save after edit)
// Body: { rows: [...] }
// ---------------------------------------------------------------------------
briefs.put('/:id/rows', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ rows: Partial<BriefRow>[] }>()

  const existing = await c.env.DB.prepare('SELECT id FROM briefs WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Brief not found' }, 404)

  await c.env.DB.prepare('DELETE FROM brief_rows WHERE brief_id = ?').bind(id).run()

  let order = 0
  for (const row of body.rows || []) {
    await insertRow(c.env.DB, id, row, order++)
  }

  await c.env.DB.prepare(`UPDATE briefs SET updated_at = datetime('now') WHERE id = ?`).bind(id).run()

  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/briefs/:id/rows — add a single row
// ---------------------------------------------------------------------------
briefs.post('/:id/rows', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<BriefRow>>()

  const existing = await c.env.DB.prepare('SELECT id FROM briefs WHERE id = ?').bind(id).first()
  if (!existing) return c.json({ error: 'Brief not found' }, 404)

  const { results } = await c.env.DB.prepare('SELECT COALESCE(MAX(row_order), -1) as maxOrder FROM brief_rows WHERE brief_id = ?')
    .bind(id)
    .all<{ maxOrder: number }>()
  const nextOrder = (results[0]?.maxOrder ?? -1) + 1

  const rowId = await insertRow(c.env.DB, id, body, nextOrder)
  return c.json({ id: rowId }, 201)
})

// ---------------------------------------------------------------------------
// PUT /api/rows/:rowId — edit a single row
// ---------------------------------------------------------------------------
briefs.put('/rows/:rowId', async (c) => {
  const rowId = c.req.param('rowId')
  const body = await c.req.json<Partial<BriefRow>>()

  const existing = await c.env.DB.prepare('SELECT * FROM brief_rows WHERE id = ?').bind(rowId).first<BriefRow>()
  if (!existing) return c.json({ error: 'Row not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE brief_rows SET sector = ?, headline = ?, source_name = ?, source_date = ?, source_url = ?,
        summary = ?, impact_grade = ?, impact_text = ?, regulatory_text = ?, entities = ?
     WHERE id = ?`
  )
    .bind(
      body.sector ?? existing.sector,
      body.headline ?? existing.headline,
      body.source_name ?? existing.source_name,
      body.source_date ?? existing.source_date,
      body.source_url ?? existing.source_url,
      body.summary ?? existing.summary,
      body.impact_grade ?? existing.impact_grade,
      body.impact_text ?? existing.impact_text,
      body.regulatory_text ?? existing.regulatory_text,
      body.entities ?? existing.entities,
      rowId
    )
    .run()

  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// DELETE /api/rows/:rowId — delete a single row
// ---------------------------------------------------------------------------
briefs.delete('/rows/:rowId', async (c) => {
  const rowId = c.req.param('rowId')
  await c.env.DB.prepare('DELETE FROM brief_rows WHERE id = ?').bind(rowId).run()
  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/briefs/:id/check — run compliance + redundancy checks and persist
// ---------------------------------------------------------------------------
briefs.post('/:id/check', async (c) => {
  const id = Number(c.req.param('id'))
  const brief = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!brief) return c.json({ error: 'Brief not found' }, 404)

  const { results: rows } = await c.env.DB.prepare('SELECT * FROM brief_rows WHERE brief_id = ?').bind(id).all<BriefRow>()
  const { results: entities } = await c.env.DB.prepare('SELECT * FROM entities').all<Entity>()

  // --- Compliance ---
  await c.env.DB.prepare('DELETE FROM compliance_issues WHERE brief_id = ?').bind(id).run()

  const allIssues: { row_id: number | null; rule_code: string; severity: string; message: string; excerpt: string | null }[] = []
  for (const row of rows) {
    const issues = checkRow(row, entities)
    for (const issue of issues) {
      allIssues.push({ row_id: row.id, rule_code: issue.rule_code, severity: issue.severity, message: issue.message, excerpt: issue.excerpt })
    }
  }

  // Brief-wide check: abbreviations (BESS, DCTF, NIF, NRW, WTP, PUE, TBIP, SAC,
  // plus the v3 long tail) must be expanded on their first use anywhere in the
  // brief. v5: also checks brief.raw_text (Exec Summary/footnotes), since real
  // editions often expand an abbreviation there rather than inside a table cell.
  const abbrevFlags = checkAbbreviationsAcrossBrief(rows, brief.raw_text)
  for (const { row_id, issue } of abbrevFlags) {
    allIssues.push({ row_id, rule_code: issue.rule_code, severity: issue.severity, message: issue.message, excerpt: issue.excerpt })
  }

  // Brief-wide check (v3): mom/yoy/wow/qoq movement abbreviations never expanded anywhere.
  const movementFlags = checkMovementAbbreviations(rows, brief.raw_text)
  for (const { row_id, issue } of movementFlags) {
    allIssues.push({ row_id, rule_code: issue.rule_code, severity: issue.severity, message: issue.message, excerpt: issue.excerpt })
  }

  // v5: compute a stable content fingerprint for every issue BEFORE inserting,
  // so a reviewer's earlier dismiss/comment (keyed on the same fingerprint)
  // carries forward even though this DELETE+INSERT gives each issue a new id.
  for (const issue of allIssues) {
    const fingerprint = await fingerprintIssue(issue.row_id, issue.rule_code, issue.message)
    await c.env.DB.prepare(
      `INSERT INTO compliance_issues (brief_id, row_id, rule_code, severity, message, excerpt, fingerprint) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, issue.row_id, issue.rule_code, issue.severity, issue.message, issue.excerpt, fingerprint)
      .run()
  }

  // --- Redundancy: compare against prior briefs (same or earlier period_start, excluding self) ---
  await c.env.DB.prepare('DELETE FROM redundancy_matches WHERE brief_id = ?').bind(id).run()

  const { results: priorBriefs } = await c.env.DB.prepare(
    `SELECT * FROM briefs WHERE period_start < ? AND id != ? ORDER BY period_start DESC LIMIT 4`
  )
    .bind(brief.period_start, id)
    .all<Brief>()

  let redundancyCount = 0
  if (priorBriefs.length > 0) {
    const priorIds = priorBriefs.map((b) => b.id)
    const placeholders = priorIds.map(() => '?').join(',')
    const { results: priorRows } = await c.env.DB.prepare(
      `SELECT * FROM brief_rows WHERE brief_id IN (${placeholders})`
    )
      .bind(...priorIds)
      .all<BriefRow>()

    const candidates = findRedundancy(rows, priorRows)
    for (const candidate of candidates) {
      const record = toRedundancyMatchRecord(id, candidate, 'cross_week')
      await c.env.DB.prepare(
        `INSERT INTO redundancy_matches (brief_id, row_id, prior_brief_id, prior_row_id, similarity_score, match_type, note, scope)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(record.brief_id, record.row_id, record.prior_brief_id, record.prior_row_id, record.similarity_score, record.match_type, record.note, record.scope)
        .run()
      redundancyCount++
    }
  }

  // --- v3: intra-brief repetition — this SAME edition repeating itself ---
  // (Sec 2 restating Sec 1/3, Speed Read restating the Executive Summary, two
  // rows sharing one channel sentence — see findIntraBriefRepetition doc comment)
  const intraCandidates = findIntraBriefRepetition(rows)
  for (const candidate of intraCandidates) {
    const record = toRedundancyMatchRecord(id, candidate, 'intra_brief')
    await c.env.DB.prepare(
      `INSERT INTO redundancy_matches (brief_id, row_id, prior_brief_id, prior_row_id, similarity_score, match_type, note, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(record.brief_id, record.row_id, id, record.prior_row_id, record.similarity_score, record.match_type, record.note, record.scope)
      .run()
    redundancyCount++
  }

  await c.env.DB.prepare(`UPDATE briefs SET status = 'checked', updated_at = datetime('now') WHERE id = ?`).bind(id).run()

  return c.json({
    ok: true,
    compliance_issue_count: allIssues.length,
    redundancy_match_count: redundancyCount,
    compared_against: priorBriefs.map((b) => ({ id: b.id, week_label: b.week_label, period_start: b.period_start })),
  })
})

// ---------------------------------------------------------------------------
// GET /api/briefs/:id/compliance — retrieve stored compliance issues, joined
// with any reviewer judgement (dismissed/acknowledged + comment) so a prior
// "not applicable" ruling on a finding is visible instead of looking new
// again after every Run Check.
// ---------------------------------------------------------------------------
briefs.get('/:id/compliance', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    `SELECT ci.*, r.headline, r.sector,
            cr.status as review_status, cr.comment as review_comment, cr.reviewed_by as review_by, cr.updated_at as review_updated_at
     FROM compliance_issues ci
     LEFT JOIN brief_rows r ON r.id = ci.row_id
     LEFT JOIN compliance_reviews cr ON cr.brief_id = ci.brief_id AND cr.fingerprint = ci.fingerprint
     WHERE ci.brief_id = ? ORDER BY ci.severity ASC, ci.id ASC`
  )
    .bind(id)
    .all()
  return c.json({ issues: results })
})

// ---------------------------------------------------------------------------
// POST /api/briefs/:id/compliance/review — record a reviewer judgement
// (dismiss as not-applicable, acknowledge, or just leave a comment) on a
// specific compliance finding. Upserts on (brief_id, fingerprint) so re-
// reviewing the same finding updates rather than duplicates.
// ---------------------------------------------------------------------------
briefs.post('/:id/compliance/review', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ fingerprint: string; row_id?: number | null; rule_code: string; status: 'open' | 'dismissed' | 'acknowledged'; comment?: string; reviewed_by?: string }>()
  if (!body.fingerprint || !body.rule_code || !body.status) {
    return c.json({ error: 'fingerprint, rule_code and status are required' }, 400)
  }

  const existing = await c.env.DB.prepare(
    `SELECT * FROM compliance_reviews WHERE brief_id = ? AND fingerprint = ?`
  )
    .bind(id, body.fingerprint)
    .first()

  if (existing) {
    await c.env.DB.prepare(
      `UPDATE compliance_reviews SET status = ?, comment = ?, reviewed_by = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(body.status, body.comment ?? null, body.reviewed_by ?? null, (existing as any).id)
      .run()
  } else {
    await c.env.DB.prepare(
      `INSERT INTO compliance_reviews (brief_id, row_id, rule_code, fingerprint, status, comment, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, body.row_id ?? null, body.rule_code, body.fingerprint, body.status, body.comment ?? null, body.reviewed_by ?? null)
      .run()
  }

  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// POST /api/briefs/:id/fact-check — run fact-check against ALL rows that have
// a source_url (fetches each live article + LLM comparison). Upserts into
// fact_checks keyed on row_id so re-running refreshes rather than duplicates.
// ---------------------------------------------------------------------------
briefs.post('/:id/fact-check', async (c) => {
  const id = Number(c.req.param('id'))
  const brief = await c.env.DB.prepare('SELECT * FROM briefs WHERE id = ?').bind(id).first<Brief>()
  if (!brief) return c.json({ error: 'Brief not found' }, 404)

  const { results: rows } = await c.env.DB.prepare('SELECT * FROM brief_rows WHERE brief_id = ?').bind(id).all<BriefRow>()

  let checked = 0
  let matches = 0
  let discrepancies = 0
  let unverifiable = 0

  for (const row of rows) {
    if (!row.source_url) continue // skip rows with no source (e.g. Weekly Macro Pulse indicator rows)
    const result = await runFactCheckForRow(row, c.env)
    checked++
    if (result.verdict === 'match') matches++
    else if (result.verdict === 'discrepancy') discrepancies++
    else unverifiable++

    await c.env.DB.prepare(
      `INSERT INTO fact_checks (brief_id, row_id, source_url, verdict, summary, details, fetch_status)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(row_id) DO UPDATE SET
         source_url = excluded.source_url, verdict = excluded.verdict, summary = excluded.summary,
         details = excluded.details, fetch_status = excluded.fetch_status, checked_at = datetime('now')`
    )
      .bind(id, row.id, row.source_url, result.verdict, result.summary, JSON.stringify(result.details), result.fetch_status)
      .run()
  }

  return c.json({ ok: true, checked, matches, discrepancies, unverifiable, skipped_no_url: rows.length - checked })
})

// ---------------------------------------------------------------------------
// GET /api/briefs/:id/fact-checks — retrieve stored fact-check results
// ---------------------------------------------------------------------------
briefs.get('/:id/fact-checks', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    `SELECT fc.*, r.headline, r.sector FROM fact_checks fc
     JOIN brief_rows r ON r.id = fc.row_id
     WHERE fc.brief_id = ? ORDER BY r.row_order ASC`
  )
    .bind(id)
    .all()
  return c.json({ fact_checks: results })
})

// ---------------------------------------------------------------------------
// GET /api/briefs/:id/redundancy — retrieve stored redundancy matches
// ---------------------------------------------------------------------------
briefs.get('/:id/redundancy', async (c) => {
  const id = c.req.param('id')
  const { results } = await c.env.DB.prepare(
    `SELECT rm.*,
            r.headline as row_headline, r.sector as row_sector,
            pr.headline as prior_headline, pr.sector as prior_sector,
            pb.week_label as prior_week_label, pb.period_start as prior_period_start
     FROM redundancy_matches rm
     JOIN brief_rows r ON r.id = rm.row_id
     JOIN brief_rows pr ON pr.id = rm.prior_row_id
     JOIN briefs pb ON pb.id = rm.prior_brief_id
     WHERE rm.brief_id = ?
     ORDER BY rm.scope ASC, rm.similarity_score DESC`
  )
    .bind(id)
    .all()
  return c.json({ matches: results })
})

// ---------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------
async function insertRow(db: D1Database, briefId: number, row: Partial<BriefRow>, order: number): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO brief_rows (brief_id, sector, row_order, headline, source_name, source_date, source_url, summary, impact_grade, impact_text, regulatory_text, entities)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      briefId,
      row.sector || 'Other',
      order,
      row.headline || '(untitled)',
      row.source_name || null,
      row.source_date || null,
      row.source_url || null,
      row.summary || null,
      row.impact_grade || null,
      row.impact_text || null,
      row.regulatory_text || null,
      row.entities ? JSON.stringify(typeof row.entities === 'string' ? JSON.parse(row.entities) : row.entities) : null
    )
    .run()
  return result.meta.last_row_id as number
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export default briefs
