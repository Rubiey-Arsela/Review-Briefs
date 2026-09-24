import { Hono } from 'hono'
import type { AppEnv, DailyLogEntry } from '../lib/types'

const dailyLog = new Hono<AppEnv>()

// GET /api/daily-log?from=YYYY-MM-DD&to=YYYY-MM-DD
dailyLog.get('/', async (c) => {
  const from = c.req.query('from')
  const to = c.req.query('to')

  let query = 'SELECT * FROM daily_log'
  const params: string[] = []
  if (from && to) {
    query += ' WHERE log_date BETWEEN ? AND ?'
    params.push(from, to)
  } else if (from) {
    query += ' WHERE log_date >= ?'
    params.push(from)
  }
  query += ' ORDER BY log_date DESC, id DESC'

  const stmt = params.length > 0 ? c.env.DB.prepare(query).bind(...params) : c.env.DB.prepare(query)
  const { results } = await stmt.all<DailyLogEntry>()
  return c.json({ entries: results })
})

// POST /api/daily-log
dailyLog.post('/', async (c) => {
  const body = await c.req.json<Partial<DailyLogEntry>>()
  if (!body.log_date || !body.sector || !body.headline) {
    return c.json({ error: 'log_date, sector and headline are required' }, 400)
  }
  const result = await c.env.DB.prepare(
    `INSERT INTO daily_log (log_date, sector, headline, source_name, source_url, note, priority)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.log_date,
      body.sector,
      body.headline,
      body.source_name || null,
      body.source_url || null,
      body.note || null,
      body.priority || 'normal'
    )
    .run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// PUT /api/daily-log/:id
dailyLog.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Partial<DailyLogEntry>>()
  const existing = await c.env.DB.prepare('SELECT * FROM daily_log WHERE id = ?').bind(id).first<DailyLogEntry>()
  if (!existing) return c.json({ error: 'Entry not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE daily_log SET log_date = ?, sector = ?, headline = ?, source_name = ?, source_url = ?, note = ?, priority = ?, used_in_brief_id = ?
     WHERE id = ?`
  )
    .bind(
      body.log_date ?? existing.log_date,
      body.sector ?? existing.sector,
      body.headline ?? existing.headline,
      body.source_name ?? existing.source_name,
      body.source_url ?? existing.source_url,
      body.note ?? existing.note,
      body.priority ?? existing.priority,
      body.used_in_brief_id ?? existing.used_in_brief_id,
      id
    )
    .run()

  return c.json({ ok: true })
})

// DELETE /api/daily-log/:id
dailyLog.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM daily_log WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default dailyLog
