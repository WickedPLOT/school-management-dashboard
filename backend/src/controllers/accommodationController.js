const pool = require('../config/db');

function sectionWhere(req, alias = 'b') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` WHERE ${alias}.section_scope = $1`, params: [req.user.section] };
}

async function listOverview(req, res) {
  const { clause, params } = sectionWhere(req);
  try {
    const buildingsResult = await pool.query(
      `SELECT b.*
       FROM accommodation_buildings b
       ${clause}
       ORDER BY b.section_scope, b.name`,
      params
    );

    const roomsResult = await pool.query(
      `SELECT r.id, r.building_id, r.name, r.capacity,
              COUNT(ra.user_id) AS occupied
       FROM accommodation_rooms r
       JOIN accommodation_buildings b ON b.id = r.building_id
       LEFT JOIN room_assignments ra ON ra.room_id = r.id
       ${clause.replace('b.', 'b.')}
       GROUP BY r.id
       ORDER BY r.name`,
      params
    );

    const residentsResult = await pool.query(
      `SELECT ra.room_id, u.id, u.email, p.full_name
       FROM room_assignments ra
       JOIN users u ON u.id = ra.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       JOIN accommodation_rooms r ON r.id = ra.room_id
       JOIN accommodation_buildings b ON b.id = r.building_id
       ${clause.replace('b.', 'b.')}
       ORDER BY p.full_name ASC NULLS LAST, u.email ASC`,
      params
    );

    const unassignedResult = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.institution, p.course
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN room_assignments ra ON ra.user_id = u.id
       WHERE u.role='student' AND u.status='approved'
         ${req.user.role === 'super_admin' ? '' : 'AND u.section = $1'}
         AND ra.id IS NULL
       ORDER BY p.full_name ASC NULLS LAST, u.email ASC`,
      req.user.role === 'super_admin' ? [] : [req.user.section]
    );

    const residentsByRoom = new Map();
    for (const resident of residentsResult.rows) {
      const current = residentsByRoom.get(resident.room_id) || [];
      current.push(resident);
      residentsByRoom.set(resident.room_id, current);
    }

    const roomsByBuilding = new Map();
    for (const room of roomsResult.rows) {
      const current = roomsByBuilding.get(room.building_id) || [];
      const occupied = Number(room.occupied);
      current.push({
        ...room,
        occupied,
        state: occupied === 0 ? 'empty' : occupied >= Number(room.capacity) ? 'full' : occupied === Number(room.capacity) - 1 ? 'available' : 'partial',
        residents: residentsByRoom.get(room.id) || [],
      });
      roomsByBuilding.set(room.building_id, current);
    }

    const response = buildingsResult.rows.map((building) => ({
      ...building,
      rooms: roomsByBuilding.get(building.id) || [],
      unassigned: unassignedResult.rows.filter((student) => building.section_scope === student.section),
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createBuilding(req, res) {
  const { name, section_scope, manager_name } = req.body;
  if (!name?.trim() || !['brothers', 'sisters'].includes(section_scope)) {
    return res.status(400).json({ error: 'Building name and valid section scope are required' });
  }
  if (req.user.role !== 'super_admin' && req.user.section !== section_scope) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO accommodation_buildings (name, section_scope, manager_name)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name.trim(), section_scope, manager_name?.trim() || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createRoom(req, res) {
  const { building_id, name, capacity } = req.body;
  if (!building_id || !name?.trim() || !Number(capacity)) {
    return res.status(400).json({ error: 'building_id, room name, and capacity are required' });
  }
  try {
    const buildingResult = await pool.query('SELECT * FROM accommodation_buildings WHERE id = $1', [building_id]);
    if (!buildingResult.rows.length) return res.status(404).json({ error: 'Building not found' });
    if (req.user.role !== 'super_admin' && req.user.section !== buildingResult.rows[0].section_scope) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await pool.query(
      `INSERT INTO accommodation_rooms (building_id, name, capacity)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [building_id, name.trim(), Number(capacity)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function assignStudent(req, res) {
  const { user_id, room_id } = req.body;
  if (!user_id || !room_id) return res.status(400).json({ error: 'user_id and room_id are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query(
      `SELECT r.id, r.capacity, b.section_scope,
              COUNT(ra.user_id) AS occupied
       FROM accommodation_rooms r
       JOIN accommodation_buildings b ON b.id = r.building_id
       LEFT JOIN room_assignments ra ON ra.room_id = r.id
       WHERE r.id = $1
       GROUP BY r.id, b.section_scope`,
      [room_id]
    );
    if (!roomResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found' });
    }
    const room = roomResult.rows[0];
    if (req.user.role !== 'super_admin' && req.user.section !== room.section_scope) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (Number(room.occupied) >= Number(room.capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Room is already full' });
    }

    const userResult = await client.query('SELECT id, section FROM users WHERE id = $1 AND role = $2 AND status = $3', [user_id, 'student', 'approved']);
    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }
    if (userResult.rows[0].section !== room.section_scope) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Student section does not match building section' });
    }

    await client.query(
      `INSERT INTO room_assignments (user_id, room_id, assigned_by)
       VALUES ($1,$2,$3)
       ON CONFLICT (user_id) DO UPDATE SET
         room_id = EXCLUDED.room_id,
         assigned_by = EXCLUDED.assigned_by,
         assigned_at = NOW()`,
      [user_id, room_id, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ message: 'Student assigned to room' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function unassignStudent(req, res) {
  const { user_id } = req.params;
  try {
    await pool.query('DELETE FROM room_assignments WHERE user_id = $1', [user_id]);
    res.json({ message: 'Student unassigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStudentRoom(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT u.id AS user_id, b.name AS building_name, b.section_scope, b.manager_name,
              r.id AS room_id, r.name AS room_name, r.capacity, ra.assigned_at
       FROM users u
       LEFT JOIN room_assignments ra ON ra.user_id = u.id
       LEFT JOIN accommodation_rooms r ON r.id = ra.room_id
       LEFT JOIN accommodation_buildings b ON b.id = r.building_id
       WHERE u.id = $1`,
      [id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyRoom(req, res) {
  req.params.id = req.user.id;
  return getStudentRoom(req, res);
}

module.exports = {
  listOverview,
  createBuilding,
  createRoom,
  assignStudent,
  unassignStudent,
  getStudentRoom,
  getMyRoom,
};
