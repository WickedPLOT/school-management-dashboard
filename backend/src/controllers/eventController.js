const pool = require('../config/db');

function sectionFilter(req, alias = 'e') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope IN ('all', ?)`, params: [req.user.section] };
}

function userSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = ?`, params: [req.user.section] };
}

async function getLateWeight() {
  const [rows] = await pool.query('SELECT attendance_late_weight FROM app_settings WHERE id=1');
  return Number(rows[0]?.attendance_late_weight ?? 0.5);
}

async function listEvents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT e.*,
              SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END) AS marked_count,
              SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late_count,
              SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent_count,
              SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused_count
       FROM event_sessions e
       LEFT JOIN event_attendance a ON a.event_id = e.id
       WHERE 1=1${clause}
       GROUP BY e.id
       ORDER BY e.event_date DESC`,
      params
    );
    res.json(rows);
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
    const [insertResult] = await pool.query(
      `INSERT INTO event_sessions (title, description, location, event_date, section_scope, created_by)
       VALUES (?,?,?,?,?,?)`,
      [title.trim(), description?.trim() || null, location?.trim() || null, event_date, section_scope, req.user.id]
    );
    const id = insertResult.insertId;
    const [itemRows] = await pool.query('SELECT * FROM event_sessions WHERE id = ?', [id]);
    res.status(201).json(itemRows[0]);
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
    const [existingRows] = await pool.query('SELECT * FROM event_sessions WHERE id=?', [id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Event not found' });

    const existing = existingRows[0];
    if (req.user.role !== 'super_admin' && existing.section_scope !== req.user.section) {
      return res.status(403).json({ error: 'You can only update events from your section' });
    }

    await pool.query(
      `UPDATE event_sessions
       SET title=?, description=?, location=?, event_date=?, section_scope=?
       WHERE id=?`,
      [title.trim(), description?.trim() || null, location?.trim() || null, event_date, section_scope, id]
    );
    const [updatedRows] = await pool.query('SELECT * FROM event_sessions WHERE id=?', [id]);
    res.json(updatedRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteEvent(req, res) {
  const { id } = req.params;
  try {
    const [existingRows] = await pool.query('SELECT * FROM event_sessions WHERE id=?', [id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Event not found' });

    const existing = existingRows[0];
    if (req.user.role !== 'super_admin' && existing.section_scope !== req.user.section) {
      return res.status(403).json({ error: 'You can only delete events from your section' });
    }

    await pool.query('DELETE FROM event_sessions WHERE id=?', [id]);
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getEventRoster(req, res) {
  const { id } = req.params;
  try {
    const [eventRows] = req.user.role === 'super_admin'
      ? await pool.query(
          'SELECT * FROM event_sessions e WHERE e.id = ?',
          [id]
        )
      : await pool.query(
          `SELECT * FROM event_sessions e
           WHERE e.id = ?
             AND e.section_scope IN ('all', ?)`,
          [id, req.user.section]
        );
    if (!eventRows.length) return res.status(404).json({ error: 'Event not found' });

    const event = eventRows[0];
    const [rosterRows] = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.phone, p.institution, p.course, p.year_of_study,
              g.parent_name, g.parent_phone, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       LEFT JOIN event_attendance a ON a.user_id = u.id AND a.event_id = ?
       WHERE u.role='student' AND u.status='approved'
         AND (? = 'all' OR u.section = ?)
       ORDER BY p.full_name IS NULL ASC, p.full_name ASC, u.email ASC`,
      [id, event.section_scope, event.section_scope]
    );

    res.json({ event, roster: rosterRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveEventAttendance(req, res) {
  const { id } = req.params;
  const { records } = req.body;
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array is required' });

  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [checkEventRows] = await client.query('SELECT * FROM event_sessions WHERE id=?', [id]);
    if (!checkEventRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }

    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'late', 'excused'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO event_attendance (event_id, user_id, status, marked_by, updated_at)
         VALUES (?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE
           status=VALUES(status),
           marked_by=VALUES(marked_by),
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
    const [rows] = await pool.query(
      `SELECT
         SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END) AS marked_events,
         SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present_count,
         SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) AS late_count,
         SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
         SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused_count,
         COALESCE(
           ROUND(
             (
               SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) +
               (SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) * ?)
             ) / NULLIF(SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END), 0) * 100,
             1
           ),
           0
         ) AS attendance_rate
       FROM (
         SELECT user_id, status FROM event_attendance WHERE user_id = ?
         UNION ALL
         SELECT user_id, status FROM daily_schedule_attendance WHERE user_id = ?
         UNION ALL
         SELECT user_id, status FROM program_routine_attendance WHERE user_id = ?
       ) a`,
      [lateWeight, id, id, id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAttendanceOverview(req, res) {
  const { clause, params } = userSectionFilter(req, 'u');
  try {
    const lateWeight = await getLateWeight();
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.institution, p.course,
              SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END) AS marked_events,
              SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
              SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late_count,
              SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent_count,
              SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused_count,
              COALESCE(
                ROUND(
                  (
                    SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) +
                    (SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) * ?)
                  ) / NULLIF(SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END), 0) * 100,
                  1
                ),
                0
              ) AS attendance_rate
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN (
         SELECT user_id, status FROM event_attendance
         UNION ALL
         SELECT user_id, status FROM daily_schedule_attendance
         UNION ALL
         SELECT user_id, status FROM program_routine_attendance
       ) a ON a.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
       GROUP BY u.id, p.full_name, p.institution, p.course
       ORDER BY attendance_rate DESC, p.full_name IS NULL ASC, p.full_name ASC`,
      [...params, lateWeight]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


async function getMyAttendance(req, res) {
  try {
    const lateWeight = await getLateWeight();
    const [summaryRows] = await pool.query(
      `SELECT
         SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END) AS marked_events,
         SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
         SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late_count,
         SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent_count,
         SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused_count,
         COALESCE(
           ROUND(
             (
               SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) +
               (SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) * ?)
             ) / NULLIF(SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END), 0) * 100,
             1
           ),
           0
         ) AS attendance_rate
       FROM (
         SELECT user_id, status FROM event_attendance WHERE user_id = ?
         UNION ALL
         SELECT user_id, status FROM daily_schedule_attendance WHERE user_id = ?
         UNION ALL
         SELECT user_id, status FROM program_routine_attendance WHERE user_id = ?
       ) a`,
      [lateWeight, req.user.id, req.user.id, req.user.id]
    );

    const [historyRows] = await pool.query(
      `SELECT e.id, e.title, e.description, e.location, e.event_date, e.section_scope,
              a.status AS attendance_status,
              CASE
                WHEN e.event_date > NOW() AND a.status IS NULL THEN 'upcoming'
                WHEN e.event_date <= NOW() AND a.status IS NULL THEN 'pending-mark'
                ELSE COALESCE(a.status, 'upcoming')
              END AS attendance_state
       FROM event_sessions e
       LEFT JOIN event_attendance a ON a.event_id = e.id AND a.user_id = ?
       WHERE e.section_scope IN ('all', ?)
       ORDER BY e.event_date DESC
       LIMIT 50`,
      [req.user.id, req.user.section]
    );

    const upcoming = historyRows
      .filter((row) => new Date(row.event_date).getTime() >= Date.now())
      .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
      .slice(0, 6)
      .map((row) => ({
        ...row,
        reminder_text: `Upcoming ${row.title} on ${new Date(row.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      }));

    res.json({
      summary: summaryRows[0],
      history: historyRows,
      upcoming,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStudentDashboard(req, res) {
  try {
    const lateWeight = await getLateWeight();
    const [[attendanceRows], [issueRows], [updateRows], [eventRows], [roomRows], [todayRows]] = await Promise.all([
      pool.query(
        `SELECT
           SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END) AS marked_events,
           SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) AS present_count,
           SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) AS late_count,
           SUM(CASE WHEN a.status='absent' THEN 1 ELSE 0 END) AS absent_count,
           SUM(CASE WHEN a.status='excused' THEN 1 ELSE 0 END) AS excused_count,
           COALESCE(
             ROUND(
               (
                 SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) +
                 (SUM(CASE WHEN a.status='late' THEN 1 ELSE 0 END) * ?)
               ) / NULLIF(SUM(CASE WHEN a.status IS NOT NULL THEN 1 ELSE 0 END), 0) * 100,
               1
             ),
             0
           ) AS attendance_rate
         FROM (
           SELECT user_id, status FROM event_attendance WHERE user_id = ?
           UNION ALL
           SELECT user_id, status FROM daily_schedule_attendance WHERE user_id = ?
           UNION ALL
           SELECT user_id, status FROM program_routine_attendance WHERE user_id = ?
         ) a`,
        [lateWeight, req.user.id, req.user.id, req.user.id]
      ),
      pool.query(
        `SELECT id, title, status, category, created_at AS updated_at
         FROM issue_reports
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, track, review_status, progress_score, COALESCE(reviewed_at, created_at) AS updated_at, created_at
         FROM student_updates
         WHERE user_id = ?
         ORDER BY COALESCE(reviewed_at, created_at) DESC
         LIMIT 5`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, title, location, event_date, section_scope
         FROM event_sessions
         WHERE section_scope IN ('all', ?)
           AND event_date >= NOW()
         ORDER BY event_date ASC
         LIMIT 4`,
        [req.user.section]
      ),
      pool.query(
        `SELECT b.name AS building_name, r.name AS room_name
         FROM room_assignments ra
         JOIN accommodation_rooms r ON r.id = ra.room_id
         JOIN accommodation_buildings b ON b.id = r.building_id
         WHERE ra.user_id = ?`,
        [req.user.id]
      ),
      pool.query(
        `SELECT id, title, location, event_date, section_scope
         FROM event_sessions
         WHERE section_scope IN ('all', ?)
           AND DATE(event_date) = CURRENT_DATE
         ORDER BY event_date ASC`,
        [req.user.section]
      ),
    ]);

    const attendance = attendanceRows[0];
    const lastIssue = issueRows[0] || null;
    const lastUpdate = updateRows[0] || null;
    const room = roomRows[0] || null;

    res.json({
      attendance,
      upcoming_events: eventRows,
      todays_events: todayRows,
      latest_issue: lastIssue,
      latest_update: lastUpdate,
      room,
      quick_stats: {
        attendance_rate: Number(attendance.attendance_rate || 0),
        upcoming_events: eventRows.length,
        unresolved_issues: issueRows.filter((row) => row.status !== 'resolved').length,
        reviewed_updates: updateRows.filter((row) => row.review_status === 'reviewed').length,
      },
    });
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
  getMyAttendance,
  getStudentDashboard,
};
