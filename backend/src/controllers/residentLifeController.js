const pool = require('../config/db');

function adminSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = ?`, params: [req.user.section] };
}

function scopeFilter(req, alias = 's') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope = ?`, params: [req.user.section] };
}

function routineScopeFilter(req, alias = 'pr', publishedOnly = false) {
  const publishedClause = publishedOnly ? ` AND ${alias}.is_published = TRUE` : '';
  if (req.user.role === 'super_admin' && !publishedOnly) return { clause: publishedClause, params: [] };
  return { clause: `${publishedClause} AND ${alias}.section_scope IN (?, 'all')`, params: [req.user.section] };
}

async function createNotification(client, userId, title, message, kind = 'general', actionUrl = null) {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, kind, action_url)
     VALUES (?,?,?,?,?)`,
    [userId, title, message, kind, actionUrl]
  );
}

async function listQuranAssignments(req, res) {
  const { clause, params } = adminSectionFilter(req, 'u');
  try {
    const [rows] = await pool.query(
      `SELECT qa.*, u.email, u.section, p.full_name, marker.email AS marked_by_email
       FROM quran_assignments qa
       JOIN users u ON u.id = qa.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users marker ON marker.id = qa.marked_by
       WHERE 1=1${clause}
       ORDER BY qa.assigned_for DESC, qa.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createQuranAssignment(req, res) {
  const { user_id, audience = 'one', page_from, page_to, assigned_for, notes } = req.body;
  if (!page_from || !page_to || !assigned_for) {
    return res.status(400).json({ error: 'page_from, page_to and assigned_for are required' });
  }
  if (!['one', 'all'].includes(audience)) {
    return res.status(400).json({ error: 'Invalid audience' });
  }

  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');

    let recipients = [];
    if (audience === 'all') {
      const [rows] = await client.query(
        `SELECT id, email, section
         FROM users
         WHERE role = 'student' AND status = 'approved'${req.user.role === 'super_admin' ? '' : ' AND section = ?'}
         ORDER BY id ASC`,
        req.user.role === 'super_admin' ? [] : [req.user.section]
      );
      recipients = rows;
    } else {
      if (!user_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'user_id is required for individual assignment' });
      }
      const [userRows] = await client.query('SELECT id, email, section FROM users WHERE id=? AND role=?', [user_id, 'student']);
      if (!userRows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }
      if (req.user.role !== 'super_admin' && userRows[0].section !== req.user.section) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      recipients = userRows;
    }

    const createdRows = [];
    for (const recipient of recipients) {
      const [insertResult] = await client.query(
        `INSERT INTO quran_assignments (user_id, page_from, page_to, assigned_for, notes, assigned_by)
         VALUES (?,?,?,?,?,?)`,
        [recipient.id, String(page_from).trim(), String(page_to).trim(), assigned_for, notes?.trim() || null, req.user.id]
      );
      const [newRows] = await client.query('SELECT * FROM quran_assignments WHERE id = ?', [insertResult.insertId]);
      const created = newRows[0];
      createdRows.push(created);

      await createNotification(
        client,
        recipient.id,
        'New Qur\'an duty assigned',
        `You have been assigned Qur'an reading from page ${page_from} to page ${page_to}.`,
        'quran-duty',
        '/student/dashboard'
      );
    }

    await client.query('COMMIT');
    res.status(201).json(audience === 'all' ? createdRows : createdRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function updateQuranAssignment(req, res) {
  const { id } = req.params;
  const { status, admin_note, notes, page_from, page_to, assigned_for } = req.body;
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [existingRows] = await client.query(
      `SELECT qa.*, u.section
       FROM quran_assignments qa
       JOIN users u ON u.id = qa.user_id
       WHERE qa.id = ?`,
      [id]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (req.user.role !== 'super_admin' && existingRows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const merged = {
      ...existingRows[0],
      status: status || existingRows[0].status,
      admin_note: admin_note ?? existingRows[0].admin_note,
      notes: notes ?? existingRows[0].notes,
      page_from: page_from ?? existingRows[0].page_from,
      page_to: page_to ?? existingRows[0].page_to,
      assigned_for: assigned_for ?? existingRows[0].assigned_for,
    };

    const completedAt = merged.status === 'completed' ? new Date() : null;
    await client.query(
      `UPDATE quran_assignments
       SET page_from = ?,
           page_to = ?,
           assigned_for = ?,
           notes = ?,
           admin_note = ?,
           status = ?,
           marked_by = ?,
           completed_at = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [merged.page_from, merged.page_to, merged.assigned_for, merged.notes, merged.admin_note, merged.status, req.user.id, completedAt, id]
    );
    const [rows] = await client.query('SELECT * FROM quran_assignments WHERE id = ?', [id]);

    if (merged.status === 'completed') {
      await createNotification(
        client,
        existingRows[0].user_id,
        'Qur\'an duty marked complete',
        `Your assigned reading from page ${merged.page_from} to page ${merged.page_to} has been marked complete.`,
        'quran-duty',
        '/student/dashboard'
      );
    }

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listDailySchedules(req, res) {
  const { clause, params } = scopeFilter(req, 'ds');
  try {
    const [rows] = await pool.query(
      `SELECT ds.*, creator.email AS created_by_email
       FROM daily_schedules ds
       LEFT JOIN users creator ON creator.id = ds.created_by
       WHERE 1=1${clause}
       ORDER BY ds.schedule_date DESC, ds.start_time IS NULL ASC, ds.start_time ASC`,
      params
    );
    const weeklyIds = rows.filter((r) => r.repeat_mode === 'weekly').map((r) => r.id);
    let presenterMap = {};
    if (weeklyIds.length) {
      const placeholders = weeklyIds.map(() => '?').join(',');
      const [dpRows] = await pool.query(
        `SELECT * FROM schedule_day_presenters WHERE schedule_id IN (${placeholders}) ORDER BY day_of_week`,
        weeklyIds
      );
      for (const row of dpRows) {
        if (!presenterMap[row.schedule_id]) presenterMap[row.schedule_id] = [];
        presenterMap[row.schedule_id].push(row);
      }
    }
    res.json(rows.map((r) => ({ ...r, day_presenters: presenterMap[r.id] || [] })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createDailySchedule(req, res) {
  const { title, description, schedule_date, start_time, end_time, section_scope, repeat_mode = 'daily', repeat_pattern = 'once', repeat_days, end_date, presenter_user_id, presenter_name } = req.body;
  if (!title?.trim() || !schedule_date || !section_scope) {
    return res.status(400).json({ error: 'title, schedule_date and section_scope are required' });
  }
  if (!['brothers', 'sisters'].includes(section_scope)) {
    return res.status(400).json({ error: 'Invalid section scope' });
  }
  if (!['once', 'daily', 'weekly'].includes(repeat_mode)) {
    return res.status(400).json({ error: 'Invalid repeat mode' });
  }
  const validPatterns = ['once', 'daily', 'weekdays', 'weekends', 'specific_days', 'week_only', 'month_only'];
  if (repeat_pattern && !validPatterns.includes(repeat_pattern)) {
    return res.status(400).json({ error: 'Invalid repeat_pattern' });
  }
  if (req.user.role !== 'super_admin' && section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let presenterId = null;
  let presenterName = presenter_name?.trim() || null;
  if (presenter_user_id) {
    const [presenterRows] = await pool.query('SELECT id, section FROM users WHERE id=? AND role=?', [presenter_user_id, 'student']);
    if (!presenterRows.length) return res.status(404).json({ error: 'Presenter student not found' });
    if (req.user.role !== 'super_admin' && presenterRows[0].section !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    presenterId = presenterRows[0].id;
    if (!presenterName) presenterName = null;
  }

  try {
    const [insertResult] = await pool.query(
      `INSERT INTO daily_schedules (title, description, schedule_date, start_time, end_time, section_scope, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [title.trim(), description?.trim() || null, schedule_date, start_time || null, end_time || null, section_scope, repeat_mode, repeat_pattern, repeat_days ? JSON.stringify(repeat_days) : null, end_date || null, presenterId, presenterName, req.user.id]
    );
    const [createdRows] = await pool.query('SELECT * FROM daily_schedules WHERE id = ?', [insertResult.insertId]);
    const created = createdRows[0];
    if (repeat_mode === 'weekly' && Array.isArray(req.body.day_presenters)) {
      for (const dp of req.body.day_presenters) {
        if (dp.day_of_week == null) continue;
        await pool.query(
          `INSERT INTO schedule_day_presenters (schedule_id, day_of_week, presenter_user_id, presenter_name)
           VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE
           presenter_user_id=VALUES(presenter_user_id), presenter_name=VALUES(presenter_name)`,
          [created.id, dp.day_of_week, dp.presenter_user_id || null, dp.presenter_name?.trim() || null]
        );
        if (dp.presenter_user_id) {
          const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const dayName = days[dp.day_of_week] || `Day ${dp.day_of_week}`;
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, kind, action_url)
             VALUES (?,?,?,?,?)`,
            [dp.presenter_user_id, `You are presenting: ${created.title}`, `You have been assigned as presenter for "${created.title}" every ${dayName}.`, 'schedule', `/student/dashboard`]
          ).catch(() => {});
        }
      }
      const [dayPresenterRows] = await pool.query('SELECT * FROM schedule_day_presenters WHERE schedule_id=? ORDER BY day_of_week', [created.id]);
      created.day_presenters = dayPresenterRows;
    } else {
      created.day_presenters = [];
      if (presenterId) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, kind, action_url)
           VALUES (?,?,?,?,?)`,
          [presenterId, `You are presenting: ${created.title}`, `You have been assigned as presenter for the activity "${created.title}" on ${created.schedule_date}.`, 'schedule', `/student/dashboard`]
        ).catch(() => {});
      }
    }
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateDailySchedule(req, res) {
  const { id } = req.params;
  const { title, description, schedule_date, start_time, end_time, section_scope, status, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name } = req.body;
  const [existingRows] = await pool.query('SELECT * FROM daily_schedules WHERE id = ?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existingRows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const merged = { ...existingRows[0], title, description, schedule_date, start_time, end_time, section_scope, status, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name };
  if (!['brothers', 'sisters'].includes(merged.section_scope)) {
    return res.status(400).json({ error: 'Invalid section scope' });
  }
  if (!['once', 'daily', 'weekly'].includes(merged.repeat_mode || 'once')) {
    return res.status(400).json({ error: 'Invalid repeat mode' });
  }
  try {
    await pool.query(
      `UPDATE daily_schedules
       SET title=?, description=?, schedule_date=?, start_time=?, end_time=?, section_scope=?, status=?, repeat_mode=?, repeat_pattern=?, repeat_days=?, end_date=?, presenter_user_id=?, presenter_name=?, updated_at=NOW()
       WHERE id=?`,
      [merged.title?.trim(), merged.description?.trim() || null, merged.schedule_date, merged.start_time || null, merged.end_time || null, merged.section_scope, merged.status || 'scheduled', merged.repeat_mode || 'once', merged.repeat_pattern || 'once', merged.repeat_days ? JSON.stringify(merged.repeat_days) : null, merged.end_date || null, merged.presenter_user_id || null, merged.presenter_name?.trim() || null, id]
    );
    const [rows] = await pool.query('SELECT * FROM daily_schedules WHERE id = ?', [id]);
    const updated = rows[0];
    if (merged.repeat_mode === 'weekly' && Array.isArray(req.body.day_presenters)) {
      for (const dp of req.body.day_presenters) {
        if (dp.day_of_week == null) continue;
        await pool.query(
          `INSERT INTO schedule_day_presenters (schedule_id, day_of_week, presenter_user_id, presenter_name)
           VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE
           presenter_user_id=VALUES(presenter_user_id), presenter_name=VALUES(presenter_name)`,
          [id, dp.day_of_week, dp.presenter_user_id || null, dp.presenter_name?.trim() || null]
        );
      }
    }
    const [dayPresenterRows] = await pool.query('SELECT * FROM schedule_day_presenters WHERE schedule_id=? ORDER BY day_of_week', [id]);
    updated.day_presenters = dayPresenterRows;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteDailySchedule(req, res) {
  const { id } = req.params;
  const [existingRows] = await pool.query('SELECT * FROM daily_schedules WHERE id = ?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existingRows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM daily_schedules WHERE id = ?', [id]);
  res.json({ message: 'Schedule deleted' });
}

async function getDailyScheduleAttendance(req, res) {
  const { id } = req.params;
  try {
    const [scheduleRows] = await pool.query('SELECT * FROM daily_schedules WHERE id=?', [id]);
    if (!scheduleRows.length) return res.status(404).json({ error: 'Schedule item not found' });
    if (req.user.role !== 'super_admin' && scheduleRows[0].section_scope !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [rosterRows] = await pool.query(
      `SELECT u.id, u.email, p.full_name, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN daily_schedule_attendance a ON a.user_id = u.id AND a.schedule_id = ? AND a.attendance_date = CURRENT_DATE
       WHERE u.role='student' AND u.status='approved'${req.user.role === 'super_admin' ? '' : ' AND u.section = ?'}
       ORDER BY COALESCE(p.full_name, u.email) ASC`,
      req.user.role === 'super_admin' ? [id] : [id, req.user.section]
    );
    res.json({ schedule: scheduleRows[0], roster: rosterRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveDailyScheduleAttendance(req, res) {
  const { id } = req.params;
  const { records = [] } = req.body;
  const [existingRows] = await pool.query('SELECT * FROM daily_schedules WHERE id=?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existingRows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'excused', 'late'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO daily_schedule_attendance (schedule_id, user_id, attendance_date, status, marked_by, updated_at)
         VALUES (?,?,CURRENT_DATE,?,?,NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by), updated_at = NOW()`,
        [id, record.user_id, record.status, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function getRoutineAttendance(req, res) {
  const { id } = req.params;
  try {
    const [routineRows] = await pool.query('SELECT * FROM program_routines WHERE id=?', [id]);
    if (!routineRows.length) return res.status(404).json({ error: 'Routine not found' });
    if (req.user.role !== 'super_admin' && routineRows[0].section_scope !== req.user.section && routineRows[0].section_scope !== 'all') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [rosterRows] = await pool.query(
      `SELECT u.id, u.email, p.full_name, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN program_routine_attendance a ON a.user_id = u.id AND a.routine_id = ? AND a.attendance_date = ?
       WHERE u.role='student' AND u.status='approved'${req.user.role === 'super_admin' ? '' : ' AND u.section = ?'}
       ORDER BY COALESCE(p.full_name, u.email) ASC`,
      req.user.role === 'super_admin' ? [id, req.query.date || new Date().toISOString().split('T')[0]] : [id, req.query.date || new Date().toISOString().split('T')[0], req.user.section]
    );
    res.json({ routine: routineRows[0], roster: rosterRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveRoutineAttendance(req, res) {
  const { id } = req.params;
  const { records = [], date } = req.body;
  const attendanceDate = date || new Date().toISOString().split('T')[0];
  const [existingRows] = await pool.query('SELECT * FROM program_routines WHERE id=?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Routine not found' });
  if (req.user.role !== 'super_admin' && existingRows[0].section_scope !== req.user.section && existingRows[0].section_scope !== 'all') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'excused', 'late'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO program_routine_attendance (routine_id, user_id, attendance_date, status, marked_by, updated_at)
         VALUES (?,?,?,?,?,NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), marked_by = VALUES(marked_by), updated_at = NOW()`,
        [id, record.user_id, attendanceDate, record.status, req.user.id]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

function validateRoutineScope(req, sectionScope) {
  if (!['brothers', 'sisters', 'all'].includes(sectionScope)) return 'Invalid section scope';
  if (req.user.role !== 'super_admin' && sectionScope !== req.user.section) return 'Forbidden';
  return null;
}

async function listRoutines(req, res) {
  const { clause, params } = routineScopeFilter(req, 'pr');
  try {
    const [rows] = await pool.query(
      `SELECT pr.*, creator.email AS created_by_email
       FROM program_routines pr
       LEFT JOIN users creator ON creator.id = pr.created_by
       WHERE 1=1${clause}
       ORDER BY pr.category ASC, pr.day_scope IS NULL ASC, pr.day_scope ASC, pr.period IS NULL ASC, pr.period ASC, pr.sort_order ASC, pr.id ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createRoutine(req, res) {
  const { category, title, description, day_scope, period, start_time, end_time, section_scope, sort_order, is_published } = req.body;
  if (!['daily', 'holiday', 'personal', 'activity'].includes(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const scope = req.user.role === 'super_admin' ? (section_scope || 'all') : req.user.section;
  const scopeError = validateRoutineScope(req, scope);
  if (scopeError) return res.status(scopeError === 'Forbidden' ? 403 : 400).json({ error: scopeError });

  try {
    const [insertResult] = await pool.query(
      `INSERT INTO program_routines
       (category, title, description, day_scope, period, start_time, end_time, section_scope, sort_order, is_published, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        category,
        title.trim(),
        description?.trim() || null,
        day_scope?.trim() || null,
        period?.trim() || null,
        start_time || null,
        end_time || null,
        scope,
        Number(sort_order) || 0,
        is_published !== false,
        req.user.id,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM program_routines WHERE id = ?', [insertResult.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateRoutine(req, res) {
  const { id } = req.params;
  const [existingRows] = await pool.query('SELECT * FROM program_routines WHERE id = ?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Routine item not found' });
  if (req.user.role !== 'super_admin' && existingRows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const merged = { ...existingRows[0], ...req.body };
  if (!['daily', 'holiday', 'personal', 'activity'].includes(merged.category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!merged.title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const scope = req.user.role === 'super_admin' ? merged.section_scope : req.user.section;
  const scopeError = validateRoutineScope(req, scope);
  if (scopeError) return res.status(scopeError === 'Forbidden' ? 403 : 400).json({ error: scopeError });

  try {
    await pool.query(
      `UPDATE program_routines
       SET category=?, title=?, description=?, day_scope=?, period=?, start_time=?, end_time=?,
           section_scope=?, sort_order=?, is_published=?, updated_at=NOW()
       WHERE id=?`,
      [
        merged.category,
        merged.title.trim(),
        merged.description?.trim() || null,
        merged.day_scope?.trim() || null,
        merged.period?.trim() || null,
        merged.start_time || null,
        merged.end_time || null,
        scope,
        Number(merged.sort_order) || 0,
        merged.is_published !== false,
        id,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM program_routines WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteRoutine(req, res) {
  const { id } = req.params;
  const [existingRows] = await pool.query('SELECT * FROM program_routines WHERE id = ?', [id]);
  if (!existingRows.length) return res.status(404).json({ error: 'Routine item not found' });
  const scope = existingRows[0].section_scope;
  if (req.user.role !== 'super_admin' && scope !== 'all' && scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM program_routines WHERE id = ?', [id]);
  res.json({ message: 'Routine deleted' });
}

async function listMeetings(req, res) {
  const { clause, params } = adminSectionFilter(req, 'u');
  try {
    const [rows] = await pool.query(
      `SELECT sm.*, u.email, u.section, p.full_name, creator.email AS created_by_email
       FROM student_meetings sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users creator ON creator.id = sm.created_by
       WHERE 1=1${clause}
       ORDER BY sm.meeting_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createMeeting(req, res) {
  const { user_id, title, agenda, meeting_at, location } = req.body;
  if (!user_id || !title?.trim() || !meeting_at) {
    return res.status(400).json({ error: 'user_id, title and meeting_at are required' });
  }
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [userRows] = await client.query('SELECT id, section FROM users WHERE id=? AND role=?', [user_id, 'student']);
    if (!userRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }
    if (req.user.role !== 'super_admin' && userRows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [insertResult] = await client.query(
      `INSERT INTO student_meetings (user_id, title, agenda, meeting_at, location, created_by)
       VALUES (?,?,?,?,?,?)`,
      [user_id, title.trim(), agenda?.trim() || null, meeting_at, location?.trim() || null, req.user.id]
    );
    const [rows] = await client.query('SELECT * FROM student_meetings WHERE id = ?', [insertResult.insertId]);

    await createNotification(
      client,
      user_id,
      'One-on-one meeting scheduled',
      `A meeting titled "${title.trim()}" has been scheduled for you.`,
      'meeting',
      '/student/announcements'
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function updateMeeting(req, res) {
  const { id } = req.params;
  const { title, agenda, meeting_at, location, status, outcome_note } = req.body;
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [existingRows] = await client.query(
      `SELECT sm.*, u.section
       FROM student_meetings sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.id = ?`,
      [id]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (req.user.role !== 'super_admin' && existingRows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const merged = { ...existingRows[0], title, agenda, meeting_at, location, status, outcome_note };
    const completedAt = merged.status === 'completed' ? new Date() : null;
    await client.query(
      `UPDATE student_meetings
       SET title=?, agenda=?, meeting_at=?, location=?, status=?, outcome_note=?, completed_at=?, updated_at=NOW()
       WHERE id=?`,
      [merged.title?.trim(), merged.agenda?.trim() || null, merged.meeting_at, merged.location?.trim() || null, merged.status || 'scheduled', merged.outcome_note?.trim() || null, completedAt, id]
    );
    const [rows] = await client.query('SELECT * FROM student_meetings WHERE id = ?', [id]);

    await createNotification(
      client,
      existingRows[0].user_id,
      'Meeting updated',
      `Your meeting "${merged.title}" is now marked as ${merged.status || 'scheduled'}.`,
      'meeting',
      '/student/announcements'
    );

    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listMyQuranAssignments(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM quran_assignments
       WHERE user_id = ?
       ORDER BY assigned_for DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMySchedule(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, r.presenter_name AS roster_presenter_name, rp.full_name AS roster_presenter_full_name
       FROM daily_schedules s
       LEFT JOIN schedule_date_roster r ON r.schedule_id = s.id AND r.roster_date = CURRENT_DATE
       LEFT JOIN profiles rp ON rp.user_id = r.presenter_user_id
       WHERE s.section_scope = ?
       ORDER BY s.schedule_date DESC, s.start_time IS NULL ASC, s.start_time ASC`,
      [req.user.section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMyRoutines(req, res) {
  const { clause, params } = routineScopeFilter(req, 'pr', true);
  try {
    const [rows] = await pool.query(
      `SELECT * FROM program_routines pr
       WHERE 1=1${clause}
       ORDER BY pr.category ASC, pr.day_scope IS NULL ASC, pr.day_scope ASC, pr.period IS NULL ASC, pr.period ASC, pr.sort_order ASC, pr.id ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMyMeetings(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM student_meetings
       WHERE user_id = ?
       ORDER BY meeting_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listQuranAssignments,
  createQuranAssignment,
  updateQuranAssignment,
  listDailySchedules,
  createDailySchedule,
  updateDailySchedule,
  deleteDailySchedule,
  getDailyScheduleAttendance,
  saveDailyScheduleAttendance,
  getRoutineAttendance,
  saveRoutineAttendance,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  listMeetings,
  createMeeting,
  updateMeeting,
  listMyQuranAssignments,
  listMySchedule,
  listMyRoutines,
  listMyMeetings,
  getScheduleRoster,
  saveScheduleRoster,
};

// ── Schedule Date Roster ──────────────────────────────────────────────────────

async function getScheduleRoster(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.roster_date, r.presenter_user_id, r.presenter_name, p.full_name, u.email
       FROM schedule_date_roster r
       LEFT JOIN users u ON u.id = r.presenter_user_id
       LEFT JOIN profiles p ON p.user_id = r.presenter_user_id
       WHERE r.schedule_id = ?
       ORDER BY r.roster_date ASC`,
      [id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function saveScheduleRoster(req, res) {
  const { id } = req.params;
  const { entries = [] } = req.body;
  if (!entries.length) return res.status(400).json({ error: 'Provide entries array' });
  try {
    for (const entry of entries) {
      if (!entry.roster_date) continue;
      await pool.query(
        `INSERT INTO schedule_date_roster (schedule_id, roster_date, presenter_user_id, presenter_name)
         VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE presenter_user_id = VALUES(presenter_user_id), presenter_name = VALUES(presenter_name)`,
        [id, entry.roster_date, entry.presenter_user_id || null, entry.presenter_name || null]
      );
    }
    res.json({ message: 'Roster saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
