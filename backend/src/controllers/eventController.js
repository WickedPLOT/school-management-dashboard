const pool = require('../config/db');

function sectionFilter(req, alias = 'e') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope IN ('all', $1)`, params: [req.user.section] };
}

function userSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

async function getLateWeight() {
  const result = await pool.query('SELECT attendance_late_weight FROM app_settings WHERE id=1');
  return Number(result.rows[0]?.attendance_late_weight ?? 0.5);
}

async function listEvents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const result = await pool.query(
      `SELECT e.*,
              COUNT(a.id) FILTER (WHERE a.status IS NOT NULL) AS marked_count,
              COUNT(a.id) FILTER (WHERE a.status='present') AS present_count,
              COUNT(a.id) FILTER (WHERE a.status='late') AS late_count,
              COUNT(a.id) FILTER (WHERE a.status='absent') AS absent_count,
              COUNT(a.id) FILTER (WHERE a.status='excused') AS excused_count
       FROM event_sessions e
       LEFT JOIN event_attendance a ON a.event_id = e.id
       WHERE 1=1${clause}
       GROUP BY e.id
       ORDER BY e.event_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createEvent(req, res) {
  const { title, description, location, event_date, section_scope } = req.body;
  if (!title?.trim() || !event_date || !section_scope) {
    return res.status(400).json({ error: 'title, event_date and section_scope are required' });
  }
  if (!['brothers', 'sisters', 'all'].includes(section_scope)) {
    return res.status(400).json({ error: 'Invalid section scope' });
  }
  if (req.user.role !== 'super_admin' && section_scope !== req.user.section) {
    return res.status(403).json({ error: 'You can only create events for your section' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO event_sessions (title, description, location, event_date, section_scope, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [title.trim(), description?.trim() || null, location?.trim() || null, event_date, section_scope, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateEvent(req, res) {
  const { id } = req.params;
  const { title, description, location, event_date, section_scope } = req.body;
  if (!title?.trim() || !event_date || !section_scope) {
    return res.status(400).json({ error: 'title, event_date and section_scope are required' });
  }
  if (!['brothers', 'sisters', 'all'].includes(section_scope)) {
    return res.status(400).json({ error: 'Invalid section scope' });
  }
  if (req.user.role !== 'super_admin' && section_scope !== req.user.section) {
    return res.status(403).json({ error: 'You can only assign events to your section' });
  }

  try {
    const existingResult = await pool.query('SELECT * FROM event_sessions WHERE id=$1', [id]);
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Event not found' });

    const existing = existingResult.rows[0];
    if (req.user.role !== 'super_admin' && existing.section_scope !== req.user.section) {
      return res.status(403).json({ error: 'You can only update events from your section' });
    }

    const result = await pool.query(
      `UPDATE event_sessions
       SET title=$1, description=$2, location=$3, event_date=$4, section_scope=$5
       WHERE id=$6
       RETURNING *`,
      [title.trim(), description?.trim() || null, location?.trim() || null, event_date, section_scope, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteEvent(req, res) {
  const { id } = req.params;
  try {
    const existingResult = await pool.query('SELECT * FROM event_sessions WHERE id=$1', [id]);
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Event not found' });

    const existing = existingResult.rows[0];
    if (req.user.role !== 'super_admin' && existing.section_scope !== req.user.section) {
      return res.status(403).json({ error: 'You can only delete events from your section' });
    }

    await pool.query('DELETE FROM event_sessions WHERE id=$1', [id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getEventRoster(req, res) {
  const { id } = req.params;
  try {
    const eventResult = req.user.role === 'super_admin'
      ? await pool.query(
          `SELECT * FROM event_sessions e WHERE e.id = $1`,
          [id]
        )
      : await pool.query(
          `SELECT * FROM event_sessions e
           WHERE e.id = $1
             AND e.section_scope IN ('all', $2)`,
          [id, req.user.section]
        );
    if (!eventResult.rows.length) return res.status(404).json({ error: 'Event not found' });

    const event = eventResult.rows[0];
    const rosterResult = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.phone, p.institution, p.course, p.year_of_study,
              g.parent_name, g.parent_phone, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       LEFT JOIN event_attendance a ON a.user_id = u.id AND a.event_id = $1
       WHERE u.role='student' AND u.status='approved'
         AND ($2 = 'all' OR u.section = $2)
       ORDER BY p.full_name ASC NULLS LAST, u.email ASC`,
      [id, event.section_scope]
    );

    res.json({ event, roster: rosterResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveEventAttendance(req, res) {
  const { id } = req.params;
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checkEvent = await client.query('SELECT * FROM event_sessions WHERE id=$1', [id]);
    if (!checkEvent.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'late', 'excused'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO event_attendance (event_id, user_id, status, marked_by, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (event_id, user_id) DO UPDATE SET
           status=EXCLUDED.status,
           marked_by=EXCLUDED.marked_by,
           updated_at=NOW()`,
        [id, record.user_id, record.status, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Attendance saved' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function getAttendanceSummary(req, res) {
  const { id } = req.params;
  try {
    const lateWeight = await getLateWeight();
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE a.status IS NOT NULL) AS marked_events,
         COUNT(*) FILTER (WHERE a.status = 'present') AS present_count,
         COUNT(*) FILTER (WHERE a.status = 'late') AS late_count,
         COUNT(*) FILTER (WHERE a.status = 'absent') AS absent_count,
         COUNT(*) FILTER (WHERE a.status = 'excused') AS excused_count,
         COALESCE(
           ROUND(
             (
               (COUNT(*) FILTER (WHERE a.status = 'present'))::numeric +
               ((COUNT(*) FILTER (WHERE a.status = 'late'))::numeric * $2)
             ) / NULLIF((COUNT(*) FILTER (WHERE a.status IS NOT NULL))::numeric, 0) * 100,
             1
           ),
           0
         ) AS attendance_rate
       FROM event_attendance a
       WHERE a.user_id = $1`,
      [id, lateWeight]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAttendanceOverview(req, res) {
  const { clause, params } = userSectionFilter(req, 'u');
  try {
    const lateWeight = await getLateWeight();
    const result = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.institution, p.course,
              COUNT(a.id) FILTER (WHERE a.status IS NOT NULL) AS marked_events,
              COUNT(a.id) FILTER (WHERE a.status='present') AS present_count,
              COUNT(a.id) FILTER (WHERE a.status='late') AS late_count,
              COUNT(a.id) FILTER (WHERE a.status='absent') AS absent_count,
              COUNT(a.id) FILTER (WHERE a.status='excused') AS excused_count,
              COALESCE(
                ROUND(
                  (
                    (COUNT(a.id) FILTER (WHERE a.status='present'))::numeric +
                    ((COUNT(a.id) FILTER (WHERE a.status='late'))::numeric * $${params.length + 1})
                  ) / NULLIF((COUNT(a.id) FILTER (WHERE a.status IS NOT NULL))::numeric, 0) * 100,
                  1
                ),
                0
              ) AS attendance_rate
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN event_attendance a ON a.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
       GROUP BY u.id, p.full_name, p.institution, p.course
       ORDER BY attendance_rate DESC, p.full_name ASC NULLS LAST`,
      [...params, lateWeight]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventRoster,
  saveEventAttendance,
  getAttendanceSummary,
  getAttendanceOverview,
};
