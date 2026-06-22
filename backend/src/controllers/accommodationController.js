const pool = require('../config/db');

const FLOOR_TEMPLATES = [
  {
    name: 'Ground Floor',
    rooms: [
      { name: 'Room 1', capacity: 6 },
      { name: 'Room 2', capacity: 2 },
      { name: 'Room 3', capacity: 4 },
      { name: 'Room 4', capacity: 4 },
    ],
  },
  {
    name: '1st Floor',
    rooms: [
      { name: 'Room 5', capacity: 6 },
      { name: 'Room 6', capacity: 4 },
    ],
  },
];

async function ensureSectionFloorPlan(sectionScope) {
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');

    for (const floor of FLOOR_TEMPLATES) {
      const [buildingRows] = await client.query(
        `SELECT id FROM accommodation_buildings
         WHERE section_scope = ? AND name = ?
         LIMIT 1`,
        [sectionScope, floor.name]
      );

      if (!buildingRows.length) {
        const [insertResult] = await client.query(
          `INSERT INTO accommodation_buildings (name, section_scope, manager_name)
           VALUES (?,?,?)`,
          [floor.name, sectionScope, null]
        );
        const [newRows] = await client.query(
          'SELECT id FROM accommodation_buildings WHERE id = ?',
          [insertResult.insertId]
        );
        buildingRows = newRows;
      }

      const buildingId = buildingRows[0].id;

      for (const room of floor.rooms) {
        const [roomExistsRows] = await client.query(
          `SELECT id FROM accommodation_rooms
           WHERE building_id = ? AND name = ?
           LIMIT 1`,
          [buildingId, room.name]
        );

        if (!roomExistsRows.length) {
          await client.query(
            `INSERT INTO accommodation_rooms (building_id, name, capacity)
             VALUES (?,?,?)`,
            [buildingId, room.name, room.capacity]
          );
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function sectionWhere(req, alias = 'b') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` WHERE ${alias}.section_scope = ?`, params: [req.user.section] };
}

async function listOverview(req, res) {
  const { clause, params } = sectionWhere(req);
  try {
    if (req.user.role === 'super_admin') {
      await ensureSectionFloorPlan('brothers');
      await ensureSectionFloorPlan('sisters');
    } else {
      await ensureSectionFloorPlan(req.user.section);
    }

    const floorFilter = `${clause ? 'AND' : 'WHERE'} b.name IN ('Ground Floor', '1st Floor')`;

    const [buildingsRows] = await pool.query(
      `SELECT b.*
       FROM accommodation_buildings b
       ${clause}
       ${floorFilter}
       ORDER BY b.section_scope,
         CASE b.name
           WHEN 'Ground Floor' THEN 1
           WHEN '1st Floor' THEN 2
           ELSE 99
         END`,
      params
    );

    const [roomsRows] = await pool.query(
      `SELECT r.id, r.building_id, r.name, r.capacity,
              COUNT(ra.user_id) AS occupied
       FROM accommodation_rooms r
       JOIN accommodation_buildings b ON b.id = r.building_id
       LEFT JOIN room_assignments ra ON ra.room_id = r.id
       ${clause.replace('b.', 'b.')}
       ${floorFilter}
       GROUP BY r.id, b.section_scope, b.name
       ORDER BY b.section_scope,
         CASE b.name
           WHEN 'Ground Floor' THEN 1
           WHEN '1st Floor' THEN 2
           ELSE 99
         END,
         r.name`,
      params
    );

    const [residentsRows] = await pool.query(
      `SELECT ra.room_id, u.id, u.email, p.full_name
       FROM room_assignments ra
       JOIN users u ON u.id = ra.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       JOIN accommodation_rooms r ON r.id = ra.room_id
       JOIN accommodation_buildings b ON b.id = r.building_id
       ${clause.replace('b.', 'b.')}
       ${floorFilter}
       ORDER BY ISNULL(p.full_name), p.full_name ASC, u.email ASC`,
      params
    );

    const [unassignedRows] = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name, p.institution, p.course
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN room_assignments ra ON ra.user_id = u.id
       WHERE u.role='student' AND u.status='approved'
         ${req.user.role === 'super_admin' ? '' : 'AND u.section = ?'}
         AND ra.id IS NULL
       ORDER BY ISNULL(p.full_name), p.full_name ASC, u.email ASC`,
      req.user.role === 'super_admin' ? [] : [req.user.section]
    );

    const residentsByRoom = new Map();
    for (const resident of residentsRows) {
      const current = residentsByRoom.get(resident.room_id) || [];
      current.push(resident);
      residentsByRoom.set(resident.room_id, current);
    }

    const roomsByBuilding = new Map();
    for (const room of roomsRows) {
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

    const response = buildingsRows.map((building) => ({
      ...building,
      rooms: roomsByBuilding.get(building.id) || [],
      unassigned: unassignedRows.filter((student) => building.section_scope === student.section),
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
    const [insertResult] = await pool.query(
      `INSERT INTO accommodation_buildings (name, section_scope, manager_name)
       VALUES (?,?,?)`,
      [name.trim(), section_scope, manager_name?.trim() || null]
    );
    const [rows] = await pool.query('SELECT * FROM accommodation_buildings WHERE id = ?', [insertResult.insertId]);
    res.status(201).json(rows[0]);
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
    const [buildingRows] = await pool.query('SELECT * FROM accommodation_buildings WHERE id = ?', [building_id]);
    if (!buildingRows.length) return res.status(404).json({ error: 'Building not found' });
    if (req.user.role !== 'super_admin' && req.user.section !== buildingRows[0].section_scope) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const [insertResult] = await pool.query(
      `INSERT INTO accommodation_rooms (building_id, name, capacity)
       VALUES (?,?,?)`,
      [building_id, name.trim(), Number(capacity)]
    );
    const [rows] = await pool.query('SELECT * FROM accommodation_rooms WHERE id = ?', [insertResult.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function assignStudent(req, res) {
  const { user_id, room_id } = req.body;
  if (!user_id || !room_id) return res.status(400).json({ error: 'user_id and room_id are required' });
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [roomRows] = await client.query(
      `SELECT r.id, r.capacity, b.section_scope,
              COUNT(ra.user_id) AS occupied
       FROM accommodation_rooms r
       JOIN accommodation_buildings b ON b.id = r.building_id
       LEFT JOIN room_assignments ra ON ra.room_id = r.id
       WHERE r.id = ?
       GROUP BY r.id, b.section_scope`,
      [room_id]
    );
    if (!roomRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found' });
    }
    const room = roomRows[0];
    if (req.user.role !== 'super_admin' && req.user.section !== room.section_scope) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (Number(room.occupied) >= Number(room.capacity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Room is already full' });
    }

    const [userRows] = await client.query(
      'SELECT id, section FROM users WHERE id = ? AND role = ? AND status = ?',
      [user_id, 'student', 'approved']
    );
    if (!userRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }
    if (userRows[0].section !== room.section_scope) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Student section does not match building section' });
    }

    await client.query(
      `INSERT INTO room_assignments (user_id, room_id, assigned_by)
       VALUES (?,?,?)
       ON DUPLICATE KEY UPDATE
         room_id = VALUES(room_id),
         assigned_by = VALUES(assigned_by),
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
    await pool.query('DELETE FROM room_assignments WHERE user_id = ?', [user_id]);
    res.json({ message: 'Student unassigned' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStudentRoom(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS user_id, b.name AS building_name, b.section_scope, b.manager_name,
              r.id AS room_id, r.name AS room_name, r.capacity, ra.assigned_at
       FROM users u
       LEFT JOIN room_assignments ra ON ra.user_id = u.id
       LEFT JOIN accommodation_rooms r ON r.id = ra.room_id
       LEFT JOIN accommodation_buildings b ON b.id = r.building_id
       WHERE u.id = ?`,
      [id]
    );
    res.json(rows[0] || null);
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
