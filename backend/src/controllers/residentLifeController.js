const pool = require('../config/db');

function adminSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

function scopeFilter(req, alias = 's') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope = $1`, params: [req.user.section] };
}

function routineScopeFilter(req, alias = 'pr', publishedOnly = false) {
  const publishedClause = publishedOnly ? ` AND ${alias}.is_published = TRUE` : '';
  if (req.user.role === 'super_admin' && !publishedOnly) return { clause: publishedClause, params: [] };
  return { clause: `${publishedClause} AND ${alias}.section_scope IN ($1, 'all')`, params: [req.user.section] };
}

async function createNotification(client, userId, title, message, kind = 'general', actionUrl = null) {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, kind, action_url)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, title, message, kind, actionUrl]
  );
}

async function listQuranAssignments(req, res) {
  const { clause, params } = adminSectionFilter(req, 'u');
  try {
    const result = await pool.query(
      `SELECT qa.*, u.email, u.section, p.full_name, marker.email AS marked_by_email
       FROM quran_assignments qa
       JOIN users u ON u.id = qa.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users marker ON marker.id = qa.marked_by
       WHERE 1=1${clause}
       ORDER BY qa.assigned_for DESC, qa.created_at DESC`,
      params
    );
    res.json(result.rows);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let recipients = [];
    if (audience === 'all') {
      const result = await client.query(
        `SELECT id, email, section
         FROM users
         WHERE role = 'student' AND status = 'approved'${req.user.role === 'super_admin' ? '' : ' AND section = $1'}
         ORDER BY id ASC`,
        req.user.role === 'super_admin' ? [] : [req.user.section]
      );
      recipients = result.rows;
    } else {
      if (!user_id) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'user_id is required for individual assignment' });
      }
      const userResult = await client.query('SELECT id, email, section FROM users WHERE id=$1 AND role=$2', [user_id, 'student']);
      if (!userResult.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Student not found' });
      }
      if (req.user.role !== 'super_admin' && userResult.rows[0].section !== req.user.section) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Forbidden' });
      }
      recipients = userResult.rows;
    }

    const createdRows = [];
    for (const recipient of recipients) {
      const result = await client.query(
        `INSERT INTO quran_assignments (user_id, page_from, page_to, assigned_for, notes, assigned_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING *`,
        [recipient.id, String(page_from).trim(), String(page_to).trim(), assigned_for, notes?.trim() || null, req.user.id]
      );
      const created = result.rows[0];
      createdRows.push(created);

      await createNotification(
        client,
        recipient.id,
        'New Qur’an duty assigned',
        `You have been assigned Qur’an reading from page ${page_from} to page ${page_to}.`,
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT qa.*, u.section
       FROM quran_assignments qa
       JOIN users u ON u.id = qa.user_id
       WHERE qa.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Assignment not found' });
    }
    if (req.user.role !== 'super_admin' && existing.rows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const merged = {
      ...existing.rows[0],
      status: status || existing.rows[0].status,
      admin_note: admin_note ?? existing.rows[0].admin_note,
      notes: notes ?? existing.rows[0].notes,
      page_from: page_from ?? existing.rows[0].page_from,
      page_to: page_to ?? existing.rows[0].page_to,
      assigned_for: assigned_for ?? existing.rows[0].assigned_for,
    };

    const completedAt = merged.status === 'completed' ? new Date() : null;
    const result = await client.query(
      `UPDATE quran_assignments
       SET page_from = $1,
           page_to = $2,
           assigned_for = $3,
           notes = $4,
           admin_note = $5,
           status = $6,
           marked_by = $7,
           completed_at = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [merged.page_from, merged.page_to, merged.assigned_for, merged.notes, merged.admin_note, merged.status, req.user.id, completedAt, id]
    );

    if (merged.status === 'completed') {
      await createNotification(
        client,
        existing.rows[0].user_id,
        'Qur’an duty marked complete',
        `Your assigned reading from page ${merged.page_from} to page ${merged.page_to} has been marked complete.`,
        'quran-duty',
        '/student/dashboard'
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
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
    const result = await pool.query(
      `SELECT ds.*, creator.email AS created_by_email
       FROM daily_schedules ds
       LEFT JOIN users creator ON creator.id = ds.created_by
       WHERE 1=1${clause}
       ORDER BY ds.schedule_date DESC, ds.start_time ASC NULLS LAST`,
      params
    );
    // Attach day presenters for weekly schedules
    const rows = result.rows;
    const weeklyIds = rows.filter((r) => r.repeat_mode === 'weekly').map((r) => r.id);
    let presenterMap = {};
    if (weeklyIds.length) {
      const dp = await pool.query(
        'SELECT * FROM schedule_day_presenters WHERE schedule_id = ANY($1) ORDER BY day_of_week',
        [weeklyIds]
      );
      for (const row of dp.rows) {
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
    const presenter = await pool.query('SELECT id, section FROM users WHERE id=$1 AND role=$2', [presenter_user_id, 'student']);
    if (!presenter.rows.length) return res.status(404).json({ error: 'Presenter student not found' });
    if (req.user.role !== 'super_admin' && presenter.rows[0].section !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    presenterId = presenter.rows[0].id;
    if (!presenterName) presenterName = null;
  }

  try {
    const result = await pool.query(
      `INSERT INTO daily_schedules (title, description, schedule_date, start_time, end_time, section_scope, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [title.trim(), description?.trim() || null, schedule_date, start_time || null, end_time || null, section_scope, repeat_mode, repeat_pattern, repeat_days ? JSON.stringify(repeat_days) : null, end_date || null, presenterId, presenterName, req.user.id]
    );
    const created = result.rows[0];
    // Save per-day presenters for weekly repeat
    if (repeat_mode === 'weekly' && Array.isArray(req.body.day_presenters)) {
      for (const dp of req.body.day_presenters) {
        if (dp.day_of_week == null) continue;
        await pool.query(
          `INSERT INTO schedule_day_presenters (schedule_id, day_of_week, presenter_user_id, presenter_name)
           VALUES ($1,$2,$3,$4) ON CONFLICT (schedule_id, day_of_week) DO UPDATE
           SET presenter_user_id=$3, presenter_name=$4`,
          [created.id, dp.day_of_week, dp.presenter_user_id || null, dp.presenter_name?.trim() || null]
        );
        // Notify each assigned presenter
        if (dp.presenter_user_id) {
          const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
          const dayName = days[dp.day_of_week] || `Day ${dp.day_of_week}`;
          await pool.query(
            `INSERT INTO notifications (user_id, title, message, kind, action_url)
             VALUES ($1,$2,$3,$4,$5)`,
            [dp.presenter_user_id, `You are presenting: ${created.title}`, `You have been assigned as presenter for "${created.title}" every ${dayName}.`, 'schedule', `/student/dashboard`]
          ).catch(() => {}); // non-fatal
        }
      }
      const dayPresenters = await pool.query('SELECT * FROM schedule_day_presenters WHERE schedule_id=$1 ORDER BY day_of_week', [created.id]);
      created.day_presenters = dayPresenters.rows;
    } else {
      created.day_presenters = [];
      // Notify once/daily presenter
      if (presenterId) {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, kind, action_url)
           VALUES ($1,$2,$3,$4,$5)`,
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
  const existing = await pool.query('SELECT * FROM daily_schedules WHERE id = $1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const merged = { ...existing.rows[0], title, description, schedule_date, start_time, end_time, section_scope, status, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name };
  if (!['brothers', 'sisters'].includes(merged.section_scope)) {
    return res.status(400).json({ error: 'Invalid section scope' });
  }
  if (!['once', 'daily', 'weekly'].includes(merged.repeat_mode || 'once')) {
    return res.status(400).json({ error: 'Invalid repeat mode' });
  }
  try {
    const result = await pool.query(
      `UPDATE daily_schedules
       SET title=$1, description=$2, schedule_date=$3, start_time=$4, end_time=$5, section_scope=$6, status=$7, repeat_mode=$8, repeat_pattern=$9, repeat_days=$10, end_date=$11, presenter_user_id=$12, presenter_name=$13, updated_at=NOW()
       WHERE id=$14
       RETURNING *`,
      [merged.title?.trim(), merged.description?.trim() || null, merged.schedule_date, merged.start_time || null, merged.end_time || null, merged.section_scope, merged.status || 'scheduled', merged.repeat_mode || 'once', merged.repeat_pattern || 'once', merged.repeat_days ? JSON.stringify(merged.repeat_days) : null, merged.end_date || null, merged.presenter_user_id || null, merged.presenter_name?.trim() || null, id]
    );
    const updated = result.rows[0];
    if (merged.repeat_mode === 'weekly' && Array.isArray(req.body.day_presenters)) {
      for (const dp of req.body.day_presenters) {
        if (dp.day_of_week == null) continue;
        await pool.query(
          `INSERT INTO schedule_day_presenters (schedule_id, day_of_week, presenter_user_id, presenter_name)
           VALUES ($1,$2,$3,$4) ON CONFLICT (schedule_id, day_of_week) DO UPDATE
           SET presenter_user_id=$3, presenter_name=$4`,
          [id, dp.day_of_week, dp.presenter_user_id || null, dp.presenter_name?.trim() || null]
        );
      }
    }
    const dayPresenters = await pool.query('SELECT * FROM schedule_day_presenters WHERE schedule_id=$1 ORDER BY day_of_week', [id]);
    updated.day_presenters = dayPresenters.rows;
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteDailySchedule(req, res) {
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM daily_schedules WHERE id = $1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM daily_schedules WHERE id = $1', [id]);
  res.json({ message: 'Schedule deleted' });
}

async function getDailyScheduleAttendance(req, res) {
  const { id } = req.params;
  try {
    const schedule = await pool.query('SELECT * FROM daily_schedules WHERE id=$1', [id]);
    if (!schedule.rows.length) return res.status(404).json({ error: 'Schedule item not found' });
    if (req.user.role !== 'super_admin' && schedule.rows[0].section_scope !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const roster = await pool.query(
      `SELECT u.id, u.email, p.full_name, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN daily_schedule_attendance a ON a.user_id = u.id AND a.schedule_id = $1 AND a.attendance_date = CURRENT_DATE
       WHERE u.role='student' AND u.status='approved'${req.user.role === 'super_admin' ? '' : ' AND u.section = $2'}
       ORDER BY COALESCE(p.full_name, u.email) ASC`,
      req.user.role === 'super_admin' ? [id] : [id, req.user.section]
    );
    res.json({ schedule: schedule.rows[0], roster: roster.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveDailyScheduleAttendance(req, res) {
  const { id } = req.params;
  const { records = [] } = req.body;
  const existing = await pool.query('SELECT * FROM daily_schedules WHERE id=$1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Schedule item not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'excused'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO daily_schedule_attendance (schedule_id, user_id, attendance_date, status, marked_by, updated_at)
         VALUES ($1,$2,CURRENT_DATE,$3,$4,NOW())
         ON CONFLICT (schedule_id, user_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()`,
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
    const routine = await pool.query('SELECT * FROM program_routines WHERE id=$1', [id]);
    if (!routine.rows.length) return res.status(404).json({ error: 'Routine not found' });
    if (req.user.role !== 'super_admin' && routine.rows[0].section_scope !== req.user.section && routine.rows[0].section_scope !== 'all') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const roster = await pool.query(
      `SELECT u.id, u.email, p.full_name, a.status AS attendance_status
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN program_routine_attendance a ON a.user_id = u.id AND a.routine_id = $1 AND a.attendance_date = $2
       WHERE u.role='student' AND u.status='approved'${req.user.role === 'super_admin' ? '' : ' AND u.section = $3'}
       ORDER BY COALESCE(p.full_name, u.email) ASC`,
      req.user.role === 'super_admin' ? [id, req.query.date || new Date().toISOString().split('T')[0]] : [id, req.query.date || new Date().toISOString().split('T')[0], req.user.section]
    );
    res.json({ routine: routine.rows[0], roster: roster.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveRoutineAttendance(req, res) {
  const { id } = req.params;
  const { records = [], date } = req.body;
  const attendanceDate = date || new Date().toISOString().split('T')[0];
  const existing = await pool.query('SELECT * FROM program_routines WHERE id=$1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Routine not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section && existing.rows[0].section_scope !== 'all') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      if (!record?.user_id || !['present', 'absent', 'excused', 'late'].includes(record.status)) continue;
      await client.query(
        `INSERT INTO program_routine_attendance (routine_id, user_id, attendance_date, status, marked_by, updated_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (routine_id, user_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, updated_at = NOW()`,
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
    const result = await pool.query(
      `SELECT pr.*, creator.email AS created_by_email
       FROM program_routines pr
       LEFT JOIN users creator ON creator.id = pr.created_by
       WHERE 1=1${clause}
       ORDER BY pr.category ASC, pr.day_scope ASC NULLS LAST, pr.period ASC NULLS LAST, pr.sort_order ASC, pr.id ASC`,
      params
    );
    res.json(result.rows);
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
    const result = await pool.query(
      `INSERT INTO program_routines
       (category, title, description, day_scope, period, start_time, end_time, section_scope, sort_order, is_published, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateRoutine(req, res) {
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM program_routines WHERE id = $1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Routine item not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const merged = { ...existing.rows[0], ...req.body };
  if (!['daily', 'holiday', 'personal', 'activity'].includes(merged.category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }
  if (!merged.title?.trim()) return res.status(400).json({ error: 'Title is required' });
  const scope = req.user.role === 'super_admin' ? merged.section_scope : req.user.section;
  const scopeError = validateRoutineScope(req, scope);
  if (scopeError) return res.status(scopeError === 'Forbidden' ? 403 : 400).json({ error: scopeError });

  try {
    const result = await pool.query(
      `UPDATE program_routines
       SET category=$1, title=$2, description=$3, day_scope=$4, period=$5, start_time=$6, end_time=$7,
           section_scope=$8, sort_order=$9, is_published=$10, updated_at=NOW()
       WHERE id=$11
       RETURNING *`,
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
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteRoutine(req, res) {
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM program_routines WHERE id = $1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Routine item not found' });
  if (req.user.role !== 'super_admin' && existing.rows[0].section_scope !== req.user.section) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM program_routines WHERE id = $1', [id]);
  res.json({ message: 'Routine deleted' });
}

async function listMeetings(req, res) {
  const { clause, params } = adminSectionFilter(req, 'u');
  try {
    const result = await pool.query(
      `SELECT sm.*, u.email, u.section, p.full_name, creator.email AS created_by_email
       FROM student_meetings sm
       JOIN users u ON u.id = sm.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users creator ON creator.id = sm.created_by
       WHERE 1=1${clause}
       ORDER BY sm.meeting_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createMeeting(req, res) {
  const { user_id, title, agenda, meeting_at, location } = req.body;
  if (!user_id || !title?.trim() || !meeting_at) {
    return res.status(400).json({ error: 'user_id, title and meeting_at are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT id, section FROM users WHERE id=$1 AND role=$2', [user_id, 'student']);
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }
    if (req.user.role !== 'super_admin' && userResult.rows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await client.query(
      `INSERT INTO student_meetings (user_id, title, agenda, meeting_at, location, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [user_id, title.trim(), agenda?.trim() || null, meeting_at, location?.trim() || null, req.user.id]
    );

    await createNotification(
      client,
      user_id,
      'One-on-one meeting scheduled',
      `A meeting titled "${title.trim()}" has been scheduled for you.`,
      'meeting',
      '/student/announcements'
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
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
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT sm.*, u.section
       FROM student_meetings sm
       JOIN users u ON u.id = sm.user_id
       WHERE sm.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Meeting not found' });
    }
    if (req.user.role !== 'super_admin' && existing.rows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    const merged = { ...existing.rows[0], title, agenda, meeting_at, location, status, outcome_note };
    const completedAt = merged.status === 'completed' ? new Date() : null;
    const result = await client.query(
      `UPDATE student_meetings
       SET title=$1, agenda=$2, meeting_at=$3, location=$4, status=$5, outcome_note=$6, completed_at=$7, updated_at=NOW()
       WHERE id=$8
       RETURNING *`,
      [merged.title?.trim(), merged.agenda?.trim() || null, merged.meeting_at, merged.location?.trim() || null, merged.status || 'scheduled', merged.outcome_note?.trim() || null, completedAt, id]
    );

    await createNotification(
      client,
      existing.rows[0].user_id,
      'Meeting updated',
      `Your meeting "${merged.title}" is now marked as ${merged.status || 'scheduled'}.`,
      'meeting',
      '/student/announcements'
    );

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listMyQuranAssignments(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM quran_assignments
       WHERE user_id = $1
       ORDER BY assigned_for DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMySchedule(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM daily_schedules
       WHERE section_scope = $1
       ORDER BY schedule_date DESC, start_time ASC NULLS LAST`,
      [req.user.section]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMyRoutines(req, res) {
  const { clause, params } = routineScopeFilter(req, 'pr', true);
  try {
    const result = await pool.query(
      `SELECT * FROM program_routines pr
       WHERE 1=1${clause}
       ORDER BY pr.category ASC, pr.day_scope ASC NULLS LAST, pr.period ASC NULLS LAST, pr.sort_order ASC, pr.id ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listMyMeetings(req, res) {
  try {
    const result = await pool.query(
      `SELECT * FROM student_meetings
       WHERE user_id = $1
       ORDER BY meeting_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
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
};
