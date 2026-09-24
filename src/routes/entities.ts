import { Hono } from 'hono'
import type { AppEnv, Entity } from '../lib/types'

const entities = new Hono<AppEnv>()

// GET /api/entities
entities.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM entities ORDER BY sector, name').all<Entity>()
  return c.json({ entities: results })
})

// POST /api/entities
entities.post('/', async (c) => {
  const body = await c.req.json<Partial<Entity>>()
  if (!body.name) return c.json({ error: 'name is required' }, 400)

  const result = await c.env.DB.prepare(
    `INSERT INTO entities (name, sector, relationship, ownership_pct, parent_entity, aliases, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      body.name,
      body.sector || null,
      body.relationship || null,
      body.ownership_pct ?? null,
      body.parent_entity || null,
      body.aliases ? JSON.stringify(typeof body.aliases === 'string' ? JSON.parse(body.aliases) : body.aliases) : '[]',
      body.notes || null
    )
    .run()
  return c.json({ id: result.meta.last_row_id }, 201)
})

// PUT /api/entities/:id
entities.put('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<Partial<Entity>>()
  const existing = await c.env.DB.prepare('SELECT * FROM entities WHERE id = ?').bind(id).first<Entity>()
  if (!existing) return c.json({ error: 'Entity not found' }, 404)

  await c.env.DB.prepare(
    `UPDATE entities SET name = ?, sector = ?, relationship = ?, ownership_pct = ?, parent_entity = ?, aliases = ?, notes = ? WHERE id = ?`
  )
    .bind(
      body.name ?? existing.name,
      body.sector ?? existing.sector,
      body.relationship ?? existing.relationship,
      body.ownership_pct ?? existing.ownership_pct,
      body.parent_entity ?? existing.parent_entity,
      body.aliases ? JSON.stringify(typeof body.aliases === 'string' ? JSON.parse(body.aliases) : body.aliases) : existing.aliases,
      body.notes ?? existing.notes,
      id
    )
    .run()

  return c.json({ ok: true })
})

// DELETE /api/entities/:id
entities.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM entities WHERE id = ?').bind(id).run()
  return c.json({ ok: true })
})

export default entities
