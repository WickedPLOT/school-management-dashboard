const pool = require('../config/db');
const { initiateStkPush, normalizePhone } = require('../services/mpesaService');

function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

function effectiveStatus(row) {
  const balance = Number(row.balance || 0);
  if (row.status === 'waived') return 'waived';
  if (balance <= 0) return 'paid';
  if (row.due_date && new Date(row.due_date) < new Date()) return 'overdue';
  if (Number(row.paid_amount || 0) > 0) return 'partial';
  return row.status || 'pending';
}

function mapCharge(row) {
  return {
    ...row,
    amount: Number(row.amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    balance: Number(row.balance || 0),
    effective_status: effectiveStatus(row),
  };
}

async function notify(client, userId, title, message, actionUrl = '/student/fees') {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, kind, action_url)
     VALUES ($1,$2,$3,'fees',$4)`,
    [userId, title, message, actionUrl]
  );
}

async function listPlans(req, res) {
  const { clause, params } = req.user.role === 'super_admin'
    ? { clause: '', params: [] }
    : { clause: ' AND section_scope IN ($1, $2)', params: [req.user.section, 'all'] };
  try {
    const result = await pool.query(
      `SELECT fp.*, creator.email AS created_by_email
       FROM fee_plans fp
       LEFT JOIN users creator ON creator.id = fp.created_by
       WHERE 1=1${clause}
       ORDER BY fp.active DESC, fp.created_at DESC`,
      params
    );
    res.json(result.rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createPlan(req, res) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only super admin can create or edit stay pricing' });
  const { name, description = '', amount, billing_cycle = 'monthly', section_scope, category = 'accommodation' } = req.body;
  const scope = req.user.role === 'super_admin' ? (section_scope || 'all') : req.user.section;
  if (!name || amount == null) return res.status(400).json({ error: 'name and amount are required' });
  if (!['brothers', 'sisters', 'all'].includes(scope)) return res.status(400).json({ error: 'Invalid section scope' });
  try {
    const result = await pool.query(
      `INSERT INTO fee_plans (name, description, amount, billing_cycle, section_scope, category, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [name.trim(), description, Number(amount), billing_cycle, scope, category, req.user.id]
    );
    res.status(201).json({ ...result.rows[0], amount: Number(result.rows[0].amount || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updatePlan(req, res) {
  if (req.user.role !== 'super_admin') return res.status(403).json({ error: 'Only super admin can create or edit stay pricing' });
  const { id } = req.params;
  const { name, description = '', amount, billing_cycle = 'monthly', section_scope, category = 'accommodation', active = true } = req.body;
  try {
    const check = await pool.query('SELECT * FROM fee_plans WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Fee plan not found' });
    if (req.user.role !== 'super_admin' && check.rows[0].section_scope !== req.user.section) return res.status(403).json({ error: 'Forbidden' });
    const scope = req.user.role === 'super_admin' ? (section_scope || check.rows[0].section_scope) : req.user.section;
    const result = await pool.query(
      `UPDATE fee_plans
       SET name=$1, description=$2, amount=$3, billing_cycle=$4, section_scope=$5, category=$6, active=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [name, description, Number(amount), billing_cycle, scope, category, !!active, id]
    );
    res.json({ ...result.rows[0], amount: Number(result.rows[0].amount || 0) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listCharges(req, res) {
  const { status = 'all', q = '' } = req.query;
  const { clause, params } = sectionFilter(req);
  const values = [...params];
  let searchClause = '';
  if (q) {
    values.push(`%${q}%`);
    searchClause = ` AND (p.full_name ILIKE $${values.length} OR u.email ILIKE $${values.length} OR fc.mpesa_account_ref ILIKE $${values.length})`;
  }
  try {
    const result = await pool.query(
      `SELECT fc.*, fp.name AS plan_name, fp.category, fp.billing_cycle,
              u.email, u.section, p.full_name,
              COALESCE(SUM(fpay.amount), 0) AS paid_amount,
              fc.amount - COALESCE(SUM(fpay.amount), 0) AS balance
       FROM fee_charges fc
       JOIN users u ON u.id = fc.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN fee_plans fp ON fp.id = fc.plan_id
       LEFT JOIN fee_payments fpay ON fpay.charge_id = fc.id
       WHERE u.role='student'${clause}${searchClause}
       GROUP BY fc.id, fp.id, u.id, p.full_name
       ORDER BY fc.due_date ASC, p.full_name ASC`,
      values
    );
    const rows = result.rows.map(mapCharge).filter((row) => status === 'all' || row.effective_status === status || row.status === status);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createCharges(req, res) {
  const { plan_id, due_date, audience = 'all', user_id, note = '' } = req.body;
  if (!plan_id || !due_date) return res.status(400).json({ error: 'plan and due date are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const planResult = await client.query('SELECT * FROM fee_plans WHERE id=$1 AND active=TRUE', [plan_id]);
    if (!planResult.rows.length) throw new Error('Active fee plan not found');
    const plan = planResult.rows[0];
    if (req.user.role !== 'super_admin' && ![req.user.section, 'all'].includes(plan.section_scope)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    let students;
    if (audience === 'one') {
      students = await client.query('SELECT id, email, section FROM users WHERE id=$1 AND role=$2 AND status=$3', [user_id, 'student', 'approved']);
    } else {
      const values = [];
      let scopeClause = '';
      if (plan.section_scope !== 'all') {
        values.push(plan.section_scope);
        scopeClause = ' AND section=$1';
      } else if (req.user.role !== 'super_admin') {
        values.push(req.user.section);
        scopeClause = ' AND section=$1';
      }
      students = await client.query(`SELECT id, email, section FROM users WHERE role='student' AND status='approved'${scopeClause}`, values);
    }

    if (!students.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No matching students found' });
    }

    const created = [];
    for (const student of students.rows) {
      if (req.user.role !== 'super_admin' && student.section !== req.user.section) continue;
      if (plan.section_scope !== 'all' && student.section !== plan.section_scope) continue;
      const ref = `COS-${student.id}-${String(plan_id).padStart(3, '0')}`;
      const inserted = await client.query(
        `INSERT INTO fee_charges (plan_id, user_id, amount, due_date, status, note, mpesa_account_ref, created_by)
         VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)
         ON CONFLICT (plan_id, user_id, due_date) DO NOTHING
         RETURNING *`,
        [plan_id, student.id, plan.amount, due_date, note, ref, req.user.id]
      );
      if (inserted.rows.length) {
        created.push(inserted.rows[0]);
        await notify(client, student.id, 'Fee assigned', `${plan.name} of KES ${Number(plan.amount).toLocaleString()} is due on ${due_date}.`, '/student/fees');
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ created_count: created.length, charges: created });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function recordPayment(req, res) {
  const { charge_id, amount, payment_method = 'cash', mpesa_receipt = '', paid_at, notes = '' } = req.body;
  if (!charge_id || amount == null) return res.status(400).json({ error: 'charge and amount are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const chargeResult = await client.query(
      `SELECT fc.*, u.section, u.email, fp.name AS plan_name
       FROM fee_charges fc
       JOIN users u ON u.id = fc.user_id
       LEFT JOIN fee_plans fp ON fp.id = fc.plan_id
       WHERE fc.id=$1`,
      [charge_id]
    );
    if (!chargeResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Charge not found' });
    }
    const charge = chargeResult.rows[0];
    if (req.user.role !== 'super_admin' && charge.section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }
    await client.query(
      `INSERT INTO fee_payments (charge_id, user_id, amount, payment_method, mpesa_receipt, paid_at, recorded_by, notes)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::timestamptz, NOW()),$7,$8)`,
      [charge_id, charge.user_id, Number(amount), payment_method, mpesa_receipt, paid_at || null, req.user.id, notes]
    );
    const totals = await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM fee_payments WHERE charge_id=$1', [charge_id]);
    const paid = Number(totals.rows[0].paid || 0);
    const nextStatus = paid >= Number(charge.amount) ? 'paid' : paid > 0 ? 'partial' : 'pending';
    await client.query('UPDATE fee_charges SET status=$1, updated_at=NOW() WHERE id=$2', [nextStatus, charge_id]);
    await notify(client, charge.user_id, 'Cash payment recorded', `KES ${Number(amount).toLocaleString()} was recorded for ${charge.plan_name || 'your fee'}.`, '/student/fees');
    await client.query('COMMIT');
    res.status(201).json({ message: 'Payment recorded', status: nextStatus, paid_amount: paid, balance: Math.max(Number(charge.amount) - paid, 0) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}


async function recordStudentCashPayment(req, res) {
  const { user_id, amount, notes = '' } = req.body;
  if (!user_id) return res.status(400).json({ error: 'student is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const studentResult = await client.query("SELECT id, email, section FROM users WHERE id=$1 AND role='student' AND status='approved'", [user_id]);
    if (!studentResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Approved student not found' });
    }
    const student = studentResult.rows[0];
    if (req.user.role !== 'super_admin' && student.section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const planResult = await client.query(
      `SELECT * FROM fee_plans
       WHERE active=TRUE AND category='accommodation' AND section_scope IN ($1, 'all')
       ORDER BY CASE WHEN section_scope=$1 THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
       LIMIT 1`,
      [student.section]
    );
    if (!planResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active accommodation stay price has been set by super admin' });
    }
    const plan = planResult.rows[0];

    const existingResult = await client.query(
      `SELECT fc.*, COALESCE(SUM(fp.amount),0) AS paid_amount, fc.amount - COALESCE(SUM(fp.amount),0) AS balance
       FROM fee_charges fc
       LEFT JOIN fee_payments fp ON fp.charge_id=fc.id
       WHERE fc.user_id=$1 AND fc.plan_id=$2
       GROUP BY fc.id
       ORDER BY fc.due_date DESC, fc.created_at DESC
       LIMIT 1`,
      [student.id, plan.id]
    );

    let charge = existingResult.rows[0];
    if (!charge || Number(charge.balance || 0) <= 0) {
      const inserted = await client.query(
        `INSERT INTO fee_charges (plan_id, user_id, amount, due_date, status, note, mpesa_account_ref, created_by)
         VALUES ($1,$2,$3,CURRENT_DATE,'pending',$4,$5,$6)
         RETURNING *, 0::numeric AS paid_amount, amount AS balance`,
        [plan.id, student.id, plan.amount, notes || 'Auto-created cash stay fee', `COS-${student.id}-${String(plan.id).padStart(3, '0')}`, req.user.id]
      );
      charge = inserted.rows[0];
    }

    const balance = Math.max(Number(charge.balance || 0), 0);
    const paymentAmount = amount == null || amount === '' ? balance : Number(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'payment amount must be greater than zero' });
    }
    if (paymentAmount > balance) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'payment amount cannot exceed outstanding balance' });
    }

    await client.query(
      `INSERT INTO fee_payments (charge_id, user_id, amount, payment_method, paid_at, recorded_by, notes)
       VALUES ($1,$2,$3,'cash',NOW(),$4,$5)`,
      [charge.id, student.id, paymentAmount, req.user.id, notes || (paymentAmount >= balance ? 'Full cash payment recorded by admin.' : 'Partial cash payment recorded by admin.')]
    );
    const totals = await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM fee_payments WHERE charge_id=$1', [charge.id]);
    const paid = Number(totals.rows[0].paid || 0);
    const nextStatus = paid >= Number(charge.amount) ? 'paid' : 'partial';
    await client.query('UPDATE fee_charges SET status=$1, updated_at=NOW() WHERE id=$2', [nextStatus, charge.id]);
    await notify(client, student.id, 'Cash payment recorded', `KES ${Number(paymentAmount).toLocaleString()} was recorded for ${plan.name}.`, '/student/fees');
    await client.query('COMMIT');
    res.status(201).json({ message: 'Cash payment recorded', charge_id: charge.id, status: nextStatus, paid_amount: paid, balance: Math.max(Number(charge.amount) - paid, 0) });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function getSummary(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const result = await pool.query(
      `SELECT fc.*, COALESCE(SUM(fp.amount),0) AS paid_amount, fc.amount - COALESCE(SUM(fp.amount),0) AS balance
       FROM fee_charges fc
       JOIN users u ON u.id = fc.user_id
       LEFT JOIN fee_payments fp ON fp.charge_id = fc.id
       WHERE u.role='student'${clause}
       GROUP BY fc.id`,
      params
    );
    const rows = result.rows.map(mapCharge);
    res.json({
      total_billed: rows.reduce((sum, row) => sum + row.amount, 0),
      total_paid: rows.reduce((sum, row) => sum + row.paid_amount, 0),
      outstanding: rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
      overdue_count: rows.filter((row) => row.effective_status === 'overdue').length,
      unpaid_count: rows.filter((row) => ['pending', 'partial', 'overdue'].includes(row.effective_status)).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStudentFees(req, res) {
  const userId = req.params.id || req.user.id;
  if (req.user.role === 'student' && Number(userId) !== Number(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
  try {
    if (req.user.role !== 'student') {
      const check = await pool.query('SELECT section FROM users WHERE id=$1', [userId]);
      if (!check.rows.length) return res.status(404).json({ error: 'Student not found' });
      if (req.user.role !== 'super_admin' && check.rows[0].section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });
    }
    const charges = await pool.query(
      `SELECT fc.*, fp.name AS plan_name, fp.category, fp.billing_cycle,
              COALESCE(SUM(pay.amount),0) AS paid_amount,
              fc.amount - COALESCE(SUM(pay.amount),0) AS balance
       FROM fee_charges fc
       LEFT JOIN fee_plans fp ON fp.id = fc.plan_id
       LEFT JOIN fee_payments pay ON pay.charge_id = fc.id
       WHERE fc.user_id=$1
       GROUP BY fc.id, fp.id
       ORDER BY fc.due_date ASC`,
      [userId]
    );
    const payments = await pool.query(
      `SELECT pay.*, fp.name AS plan_name
       FROM fee_payments pay
       LEFT JOIN fee_charges fc ON fc.id = pay.charge_id
       LEFT JOIN fee_plans fp ON fp.id = fc.plan_id
       WHERE pay.user_id=$1
       ORDER BY pay.paid_at DESC`,
      [userId]
    );
    const mappedCharges = charges.rows.map(mapCharge);
    const nextDue = mappedCharges.find((row) => row.balance > 0) || null;
    res.json({
      charges: mappedCharges,
      payments: payments.rows.map((row) => ({ ...row, amount: Number(row.amount || 0) })),
      summary: {
        total_billed: mappedCharges.reduce((sum, row) => sum + row.amount, 0),
        total_paid: mappedCharges.reduce((sum, row) => sum + row.paid_amount, 0),
        outstanding: mappedCharges.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
        next_due: nextDue,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}


async function initiateFeeStkPush(req, res) {
  const chargeId = req.params.chargeId || req.body.charge_id;
  const { phone, amount } = req.body;
  if (!chargeId || !phone) return res.status(400).json({ error: 'charge and phone are required' });
  const client = await pool.connect();
  try {
    const chargeResult = await client.query(
      `SELECT fc.*, fp.name AS plan_name, u.section, u.email
       FROM fee_charges fc
       JOIN users u ON u.id = fc.user_id
       LEFT JOIN fee_plans fp ON fp.id = fc.plan_id
       WHERE fc.id=$1`,
      [chargeId]
    );
    if (!chargeResult.rows.length) return res.status(404).json({ error: 'Charge not found' });
    const charge = chargeResult.rows[0];
    if (req.user.role === 'student' && Number(charge.user_id) !== Number(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
    if (req.user.role !== 'student' && req.user.role !== 'super_admin' && charge.section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });

    const paidResult = await client.query('SELECT COALESCE(SUM(amount),0) AS paid FROM fee_payments WHERE charge_id=$1', [chargeId]);
    const balance = Math.max(Number(charge.amount) - Number(paidResult.rows[0].paid || 0), 0);
    const requestAmount = Number(amount || balance);
    if (requestAmount <= 0) return res.status(400).json({ error: 'This charge has no outstanding balance' });
    if (requestAmount > balance) return res.status(400).json({ error: 'Payment amount cannot exceed outstanding balance' });

    const accountReference = charge.mpesa_account_ref || `COS-${charge.user_id}-${charge.id}`;
    const response = await initiateStkPush({
      phone,
      amount: requestAmount,
      accountReference,
      transactionDesc: charge.plan_name || 'Centre of Suffa fee payment',
    });

    const inserted = await client.query(
      `INSERT INTO mpesa_payment_requests
       (charge_id, user_id, phone, amount, account_reference, merchant_request_id, checkout_request_id, response_code, response_description, customer_message, status, raw_response)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [charge.id, charge.user_id, normalizePhone(phone), requestAmount, accountReference, response.MerchantRequestID, response.CheckoutRequestID, response.ResponseCode, response.ResponseDescription, response.CustomerMessage, response.ResponseCode === '0' ? 'pending' : 'failed', response]
    );
    res.status(201).json({ message: response.CustomerMessage || 'STK Push sent.', request: inserted.rows[0], provider: response });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function handleMpesaCallback(req, res) {
  const callback = req.body?.Body?.stkCallback || req.body?.stkCallback || {};
  const checkoutRequestId = callback.CheckoutRequestID;
  const resultCode = Number(callback.ResultCode);
  const metadata = callback.CallbackMetadata?.Item || [];
  const findMeta = (name) => metadata.find((item) => item.Name === name)?.Value;
  const receipt = findMeta('MpesaReceiptNumber');
  const amount = Number(findMeta('Amount') || 0);
  const phone = findMeta('PhoneNumber');
  const transactionDate = findMeta('TransactionDate');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const requestResult = await client.query('SELECT * FROM mpesa_payment_requests WHERE checkout_request_id=$1 FOR UPDATE', [checkoutRequestId]);
    if (!requestResult.rows.length) {
      await client.query('COMMIT');
      return res.json({ ResultCode: 0, ResultDesc: 'Callback accepted but request was not found' });
    }
    const request = requestResult.rows[0];
    const status = resultCode === 0 ? 'paid' : (resultCode === 1032 ? 'cancelled' : 'failed');
    await client.query(
      `UPDATE mpesa_payment_requests
       SET result_code=$1, result_desc=$2, mpesa_receipt=$3, transaction_date=$4, phone=COALESCE($5, phone), status=$6, raw_callback=$7, updated_at=NOW()
       WHERE id=$8`,
      [resultCode, callback.ResultDesc, receipt || null, transactionDate ? String(transactionDate) : null, phone ? String(phone) : null, status, req.body, request.id]
    );

    if (resultCode === 0 && request.charge_id && receipt) {
      const existing = await client.query('SELECT id FROM fee_payments WHERE mpesa_receipt=$1', [receipt]);
      if (!existing.rows.length) {
        await client.query(
          `INSERT INTO fee_payments (charge_id, user_id, amount, payment_method, mpesa_receipt, paid_at, notes)
           VALUES ($1,$2,$3,'mpesa',$4,NOW(),'Auto-confirmed by M-Pesa STK callback')`,
          [request.charge_id, request.user_id, amount || request.amount, receipt]
        );
        const totals = await client.query('SELECT fc.amount AS billed, COALESCE(SUM(fp.amount),0) AS paid FROM fee_charges fc LEFT JOIN fee_payments fp ON fp.charge_id=fc.id WHERE fc.id=$1 GROUP BY fc.id', [request.charge_id]);
        const paid = Number(totals.rows[0]?.paid || 0);
        const billed = Number(totals.rows[0]?.billed || 0);
        await client.query('UPDATE fee_charges SET status=$1, updated_at=NOW() WHERE id=$2', [paid >= billed ? 'paid' : 'partial', request.charge_id]);
        await notify(client, request.user_id, 'M-Pesa payment confirmed', `M-Pesa payment ${receipt} of KES ${Number(amount || request.amount).toLocaleString()} was confirmed.`, '/student/fees');
      }
    }
    await client.query('COMMIT');
    res.json({ ResultCode: 0, ResultDesc: 'Callback processed' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ ResultCode: 1, ResultDesc: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  listPlans,
  createPlan,
  updatePlan,
  listCharges,
  createCharges,
  recordPayment,
  recordStudentCashPayment,
  getSummary,
  getStudentFees,
  initiateFeeStkPush,
  handleMpesaCallback,
};
