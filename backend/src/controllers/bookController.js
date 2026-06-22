const pool = require('../config/db');
const pdfParse = require('pdf-parse');
const { notifyStudentsAboutNewBook } = require('../services/notificationService');

function adminSectionFilter(req, alias = 'pb') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section_scope IN ('all', ?)`, params: [req.user.section] };
}

async function parsePDFMetadata(buffer) {
  try {
    const pdfData = await pdfParse(buffer);
    return {
      totalPages: pdfData.numpages || 0,
      success: true,
    };
  } catch (err) {
    console.error('PDF parsing error:', err.message);
    return {
      totalPages: 0,
      success: false,
      error: err.message,
    };
  }
}

function bufferToBase64(buffer) {
  return buffer.toString('base64');
}

/**
 * List all books with admin filtering
 */
async function listBooks(req, res) {
  try {
    const { clause, params } = adminSectionFilter(req, 'pb');
    const [rows] = await pool.query(
      `SELECT pb.*, u.email AS created_by_email,
              COUNT(bp.id) AS student_count,
              COALESCE(ROUND(AVG(CASE WHEN pb.total_pages > 0 THEN bp.pages_read / pb.total_pages * 100 ELSE 0 END), 1), 0) AS avg_progress
       FROM platform_books pb
       LEFT JOIN users u ON u.id = pb.created_by
       LEFT JOIN book_progress bp ON bp.book_id = pb.id
       WHERE TRUE ${clause}
       GROUP BY pb.id, u.email
       ORDER BY pb.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Create book with file upload support
 */
async function createBook(req, res) {
  const { title, description, section_scope, is_published } = req.body;
  const file = req.file;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const scope = section_scope || 'all';
  if (!['brothers', 'sisters', 'all'].includes(scope)) {
    return res.status(400).json({ error: 'Invalid section_scope' });
  }

  try {
    let fileData = null;
    let fileName = null;
    let totalPages = 0;

    if (file && file.buffer) {
      const pdfMeta = await parsePDFMetadata(file.buffer);
      if (!pdfMeta.success) {
        return res.status(400).json({ error: `PDF parsing failed: ${pdfMeta.error}` });
      }
      totalPages = pdfMeta.totalPages;
      fileData = bufferToBase64(file.buffer);
      fileName = file.originalname;
    }

    const [insertResult] = await pool.query(
      `INSERT INTO platform_books (title, description, file_name, file_data, total_pages, section_scope, is_published, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title.trim(),
        description?.trim() || null,
        fileName,
        fileData,
        totalPages,
        scope,
        is_published !== false,
        req.user.id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM platform_books WHERE id = ?', [insertResult.insertId]);
    const book = rows[0];

    if (book.is_published) {
      notifyStudentsAboutNewBook(book.title, scope, book.id).catch(err =>
        console.error('Notification error:', err)
      );
    }

    res.status(201).json(book);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update book
 */
async function updateBook(req, res) {
  const { id } = req.params;
  const { title, description, section_scope, is_published } = req.body;
  const file = req.file;

  if (!title?.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const [existing] = await pool.query('SELECT * FROM platform_books WHERE id = ?', [id]);
    if (!existing.length) {
      return res.status(404).json({ error: 'Book not found' });
    }

    let fileData = null;
    let fileName = null;
    let totalPages = null;

    if (file && file.buffer) {
      const pdfMeta = await parsePDFMetadata(file.buffer);
      if (!pdfMeta.success) {
        return res.status(400).json({ error: `PDF parsing failed: ${pdfMeta.error}` });
      }
      totalPages = pdfMeta.totalPages;
      fileData = bufferToBase64(file.buffer);
      fileName = file.originalname;
    }

    await pool.query(
      `UPDATE platform_books 
       SET title = ?,
           description = ?,
           file_name = COALESCE(?, file_name),
           file_data = COALESCE(?, file_data),
           total_pages = COALESCE(?, total_pages),
           section_scope = ?,
           is_published = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        title.trim(),
        description?.trim() || null,
        fileName,
        fileData,
        totalPages,
        section_scope || 'all',
        is_published !== false,
        id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM platform_books WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Delete book
 */
async function deleteBook(req, res) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM platform_books WHERE id = ?', [id]);
    res.json({ message: 'Book deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Download book file
 */
async function downloadBook(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM platform_books WHERE id = ? AND is_published = TRUE',
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const bookData = rows[0];
    if (!bookData.file_data) {
      return res.status(404).json({ error: 'Book file not available' });
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(bookData.file_data, 'base64');

    // Set response headers
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${bookData.file_name || `${bookData.title}.pdf`}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get book student progress
 */
async function getBookStudentProgress(req, res) {
  const { id } = req.params;
  const { clause, params } = adminSectionFilter(req, 'u');
  try {
    const [book] = await pool.query('SELECT * FROM platform_books WHERE id = ?', [id]);
    if (!book.length) return res.status(404).json({ error: 'Book not found' });

    const filterClause = params.length ? clause : '';
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name,
              COALESCE(bp.pages_read, 0) AS pages_read,
              COALESCE(bp.status, 'not_started') AS status,
              bp.notes, bp.updated_at
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN book_progress bp ON bp.book_id = ? AND bp.user_id = u.id
       WHERE u.role = 'student' AND u.status = 'approved' ${filterClause}
       ORDER BY p.full_name IS NULL ASC, p.full_name ASC`,
      params.length ? [id, ...params] : [id]
    );
    res.json({ book: book[0], students: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get all students' book progress
 */
async function getAllStudentsBookProgress(req, res) {
  const { clause, params } = adminSectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, p.full_name,
              COUNT(DISTINCT pb.id) AS total_books,
              SUM(CASE WHEN bp.status = 'reading' THEN 1 ELSE 0 END) AS books_reading,
              SUM(CASE WHEN bp.status = 'completed' THEN 1 ELSE 0 END) AS books_completed,
              COALESCE(SUM(bp.pages_read), 0) AS total_pages_read,
              COALESCE(SUM(pb.total_pages), 0) AS total_book_pages
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN book_progress bp ON bp.user_id = u.id
       LEFT JOIN platform_books pb ON pb.id = bp.book_id
       WHERE u.role = 'student' AND u.status = 'approved' ${clause}
       GROUP BY u.id, u.email, u.section, p.full_name
        ORDER BY p.full_name IS NULL ASC, p.full_name ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get specific student's book details
 */
async function getStudentBookDetail(req, res) {
  const { id } = req.params;
  try {
    const [student] = await pool.query(
      `SELECT id, email, section FROM users WHERE id = ? AND role = 'student'`,
      [id]
    );
    if (!student.length) return res.status(404).json({ error: 'Student not found' });

    if (req.user.role !== 'super_admin' && student[0].section !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [books] = await pool.query(
      `SELECT pb.id, pb.title, pb.total_pages, pb.file_name,
              COALESCE(bp.pages_read, 0) AS pages_read,
              COALESCE(bp.status, 'not_started') AS status,
              bp.notes, bp.updated_at
       FROM platform_books pb
       LEFT JOIN book_progress bp ON bp.book_id = pb.id AND bp.user_id = ?
       WHERE pb.is_published = TRUE AND pb.section_scope IN ('all', ?)
       ORDER BY pb.title ASC`,
      [id, student[0].section]
    );
    res.json({ student: student[0], books });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * List books available to student
 */
async function listMyBooks(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT pb.id, pb.title, pb.description, pb.total_pages, pb.section_scope,
              pb.file_name, pb.file_data,
              COALESCE(bp.pages_read, 0) AS pages_read,
              COALESCE(bp.status, 'not_started') AS status,
              bp.notes, bp.updated_at AS progress_updated_at,
              pb.created_at
       FROM platform_books pb
       LEFT JOIN book_progress bp ON bp.book_id = pb.id AND bp.user_id = ?
       WHERE pb.is_published = TRUE AND pb.section_scope IN ('all', ?)
       ORDER BY pb.created_at DESC`,
      [req.user.id, req.user.section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update student's reading progress
 */
async function updateMyBookProgress(req, res) {
  const { book_id, pages_read, status, notes } = req.body;
  if (!book_id) return res.status(400).json({ error: 'book_id is required' });

  const validStatuses = ['not_started', 'reading', 'completed'];
  if (status && !validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });

  try {
    const [book] = await pool.query(
      `SELECT id, total_pages FROM platform_books WHERE id = ? AND is_published = TRUE AND section_scope IN ('all', ?)`,
      [book_id, req.user.section]
    );
    if (!book.length) return res.status(404).json({ error: 'Book not found' });

    const maxPages = book[0].total_pages || 0;
    const safePages = Math.min(Math.max(parseInt(pages_read) || 0, 0), maxPages > 0 ? maxPages : 999999);

    let computedStatus = status || 'reading';
    if (maxPages > 0 && safePages >= maxPages) computedStatus = 'completed';

    await pool.query(
      `INSERT INTO book_progress (book_id, user_id, pages_read, status, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         pages_read = VALUES(pages_read),
         status = VALUES(status),
         notes = VALUES(notes),
         updated_at = NOW()`,
      [book_id, req.user.id, safePages, computedStatus, notes?.trim() || null]
    );

    const [rows] = await pool.query(
      'SELECT * FROM book_progress WHERE book_id = ? AND user_id = ?',
      [book_id, req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listBooks,
  createBook,
  updateBook,
  deleteBook,
  downloadBook,
  getBookStudentProgress,
  getAllStudentsBookProgress,
  getStudentBookDetail,
  listMyBooks,
  updateMyBookProgress,
};
