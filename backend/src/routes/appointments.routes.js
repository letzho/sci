const express = require('express');
const db = require('../db/connection');
const { genId } = require('../utils/idGen');

const router = express.Router();

const VALID_CHANNELS = ['face_to_face', 'virtual_call', 'chat'];

function mapAppointment(row, customerName) {
  return {
    id: row.id,
    agentId: row.agent_id,
    customerId: row.customer_id,
    customerName: customerName || row.customer_name || null,
    scheduledAt: row.scheduled_at,
    channel: row.channel,
    title: row.title,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapBlocked(row) {
  return {
    id: row.id,
    agentId: row.agent_id,
    blockDate: row.block_date,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

/** List appointments (+ optional blocked dates) for calendar views. */
router.get('/', async (req, res) => {
  const { agentId, customerId, from, to, includeBlocked } = req.query;
  if (!agentId && !customerId) {
    return res.status(400).json({ error: 'agentId or customerId is required' });
  }

  let sql = `
    SELECT a.*, c.name AS customer_name
    FROM appointments a
    LEFT JOIN customers c ON c.id = a.customer_id
    WHERE a.status != 'cancelled'
  `;
  const params = [];

  if (agentId) {
    sql += ` AND a.agent_id = ?`;
    params.push(agentId);
  }
  if (customerId) {
    sql += ` AND a.customer_id = ?`;
    params.push(customerId);
  }
  if (from) {
    sql += ` AND a.scheduled_at >= ?`;
    params.push(from);
  }
  if (to) {
    sql += ` AND a.scheduled_at <= ?`;
    params.push(to);
  }
  sql += ` ORDER BY a.scheduled_at ASC`;

  const rows = await db.prepare(sql).all(...params);
  const appointments = rows.map((r) => mapAppointment(r));

  let blockedDates = [];
  if (includeBlocked === 'true' && agentId) {
    let blockSql = `SELECT * FROM agent_blocked_dates WHERE agent_id = ?`;
    const blockParams = [agentId];
    if (from) {
      blockSql += ` AND block_date >= ?`;
      blockParams.push(from.slice(0, 10));
    }
    if (to) {
      blockSql += ` AND block_date <= ?`;
      blockParams.push(to.slice(0, 10));
    }
    blockSql += ` ORDER BY block_date ASC`;
    const blockRows = await db.prepare(blockSql).all(...blockParams);
    blockedDates = blockRows.map(mapBlocked);
  }

  res.json({ appointments, blockedDates });
});

/** Upcoming reminders for the representative (next 48 hours). */
router.get('/reminders', async (req, res) => {
  const { agentId } = req.query;
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });

  const now = new Date().toISOString();
  const horizon = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const rows = await db
    .prepare(
      `SELECT a.*, c.name AS customer_name
       FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id
       WHERE a.agent_id = ? AND a.status = 'scheduled'
         AND a.scheduled_at >= ? AND a.scheduled_at <= ?
       ORDER BY a.scheduled_at ASC`
    )
    .all(agentId, now, horizon);

  res.json({ reminders: rows.map((r) => mapAppointment(r)) });
});

router.post('/', async (req, res) => {
  const { agentId, customerId, scheduledAt, channel, title, notes } = req.body || {};
  if (!agentId || !customerId || !scheduledAt) {
    return res.status(400).json({ error: 'agentId, customerId and scheduledAt are required' });
  }
  if (channel && !VALID_CHANNELS.includes(channel)) {
    return res.status(400).json({ error: `channel must be one of ${VALID_CHANNELS.join(', ')}` });
  }

  const agent = await db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  const customer = await db.prepare(`SELECT id, name FROM customers WHERE id = ?`).get(customerId);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  const blockDate = scheduledAt.slice(0, 10);
  const blocked = await db
    .prepare(`SELECT id FROM agent_blocked_dates WHERE agent_id = ? AND block_date = ?`)
    .get(agentId, blockDate);
  if (blocked) {
    return res.status(409).json({ error: 'This date is blocked on your calendar' });
  }

  const id = genId('appt');
  await db
    .prepare(
      `INSERT INTO appointments (id, agent_id, customer_id, scheduled_at, channel, title, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`
    )
    .run(
      id,
      agentId,
      customerId,
      scheduledAt,
      channel || 'virtual_call',
      title || 'Client meeting',
      notes || null
    );

  const row = await db
    .prepare(
      `SELECT a.*, c.name AS customer_name FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id WHERE a.id = ?`
    )
    .get(id);

  const io = req.app.get('io');
  if (io) {
    io.to(`customer_${customerId}`).emit('appointment-scheduled', { appointment: mapAppointment(row) });
  }

  res.status(201).json({ appointment: mapAppointment(row) });
});

router.post('/blocked', async (req, res) => {
  const { agentId, blockDate, reason } = req.body || {};
  if (!agentId || !blockDate) {
    return res.status(400).json({ error: 'agentId and blockDate (YYYY-MM-DD) are required' });
  }

  const existing = await db
    .prepare(`SELECT id FROM agent_blocked_dates WHERE agent_id = ? AND block_date = ?`)
    .get(agentId, blockDate.slice(0, 10));
  if (existing) {
    return res.status(409).json({ error: 'Date already blocked' });
  }

  const id = genId('block');
  await db
    .prepare(`INSERT INTO agent_blocked_dates (id, agent_id, block_date, reason) VALUES (?, ?, ?, ?)`)
    .run(id, agentId, blockDate.slice(0, 10), reason || 'Unavailable');

  const row = await db.prepare(`SELECT * FROM agent_blocked_dates WHERE id = ?`).get(id);
  res.status(201).json({ blocked: mapBlocked(row) });
});

router.patch('/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Appointment not found' });

  const { status, scheduledAt, title, notes, channel } = req.body || {};
  await db
    .prepare(
      `UPDATE appointments SET
        status = COALESCE(?, status),
        scheduled_at = COALESCE(?, scheduled_at),
        title = COALESCE(?, title),
        notes = COALESCE(?, notes),
        channel = COALESCE(?, channel)
       WHERE id = ?`
    )
    .run(status || null, scheduledAt || null, title || null, notes || null, channel || null, row.id);

  const updated = await db
    .prepare(
      `SELECT a.*, c.name AS customer_name FROM appointments a
       LEFT JOIN customers c ON c.id = a.customer_id WHERE a.id = ?`
    )
    .get(row.id);
  res.json({ appointment: mapAppointment(updated) });
});

router.delete('/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Appointment not found' });
  await db.prepare(`UPDATE appointments SET status = 'cancelled' WHERE id = ?`).run(row.id);
  res.json({ ok: true });
});

router.delete('/blocked/:id', async (req, res) => {
  const row = await db.prepare(`SELECT * FROM agent_blocked_dates WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Blocked date not found' });
  await db.prepare(`DELETE FROM agent_blocked_dates WHERE id = ?`).run(row.id);
  res.json({ ok: true });
});

module.exports = router;
