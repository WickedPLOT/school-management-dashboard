'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Toast from '@/components/Toast';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type User = { role: string; section: 'brothers' | 'sisters' };
type Student = { id: number; email: string; full_name?: string; section: string; institution?: string; course?: string };
type Plan = { id: number; name: string; description?: string; category: string; amount: number; billing_cycle: string; section_scope: string; active: boolean };
type Charge = {
  id: number; user_id: number; plan_name?: string; category?: string; full_name?: string; email: string; section: string;
  amount: number; paid_amount: number; balance: number; due_date: string; effective_status: string; note?: string;
};
type RegisterRow = { student: Student; charge: Charge | null; plan: Plan | null; amount: number; paid: number; balance: number; effectiveStatus: string; };

const money = (value: number | string | null | undefined) => `KES ${Number(value || 0).toLocaleString()}`;
const centerLabel = (section: string) => section === 'sisters' ? SISTERS_CENTER_NAME : section === 'brothers' ? BROTHERS_CENTER_NAME : 'All Centers';

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [activeTab, setActiveTab] = useState<'register' | 'pricing'>('register');
  const [status, setStatus] = useState('all');
  const [planForm, setPlanForm] = useState({ id: '', name: 'Accommodation Stay Fee', amount: '', billing_cycle: 'monthly', section_scope: 'all', category: 'accommodation', description: '' });
  const [showPlan, setShowPlan] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<RegisterRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [actionMenuRow, setActionMenuRow] = useState<RegisterRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const isSuperAdmin = user?.role === 'super_admin';

  async function load() {
    setLoading(true);
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
      const params = status === 'all' ? '' : `?status=${status}`;
      const [planData, studentData, chargeData] = await Promise.all([
        apiFetch('/admin/fees/plans'), apiFetch('/admin/students'), apiFetch(`/admin/fees/charges${params}`),
      ]);
      setPlans(planData); setStudents(studentData); setCharges(chargeData);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not load fees.' });
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [status]);

  const activePlans = useMemo(() => plans.filter((plan) => plan.active), [plans]);
  const defaultStayPlan = useMemo(() => activePlans.find((plan) => plan.category === 'accommodation' && plan.section_scope === 'all') || activePlans.find((plan) => plan.category === 'accommodation') || activePlans[0] || null, [activePlans]);
  const planForStudent = (student: Student) => (
    activePlans.find((plan) => plan.category === 'accommodation' && plan.section_scope === student.section)
    || activePlans.find((plan) => plan.category === 'accommodation' && plan.section_scope === 'all')
    || activePlans.find((plan) => plan.section_scope === student.section)
    || activePlans.find((plan) => plan.section_scope === 'all')
    || defaultStayPlan
    || null
  );
  const latestChargeByStudent = useMemo(() => {
    const map = new Map<number, Charge>();
    for (const charge of charges) {
      const current = map.get(charge.user_id);
      if (!current || new Date(charge.due_date).getTime() >= new Date(current.due_date).getTime()) map.set(charge.user_id, charge);
    }
    return map;
  }, [charges]);
  const allRegisterRows = useMemo<RegisterRow[]>(() => students.map((student) => {
    const charge = latestChargeByStudent.get(student.id) || null;
    const plan = planForStudent(student);
    const amount = charge ? Number(charge.amount || 0) : Number(plan?.amount || 0);
    const paid = charge ? Number(charge.paid_amount || 0) : 0;
    const balance = charge ? Math.max(Number(charge.balance || 0), 0) : amount;
    const effectiveStatus = charge?.effective_status || 'unpaid';
    return { student, charge, plan, amount, paid, balance, effectiveStatus };
  }), [students, latestChargeByStudent, activePlans, defaultStayPlan]);
  const registerRows = useMemo(() => allRegisterRows.filter((row) => {
    if (status === 'all') return true;
    if (status === 'pending') return row.effectiveStatus === 'pending' || row.effectiveStatus === 'unpaid';
    return row.effectiveStatus === status;
  }), [allRegisterRows, status]);
  const paidRows = useMemo(() => allRegisterRows.filter((row) => row.effectiveStatus === 'paid'), [allRegisterRows]);
  const unpaidRows = useMemo(() => allRegisterRows.filter((row) => row.balance > 0), [allRegisterRows]);

  function openCreatePlan() {
    setPlanForm({ id: '', name: 'Accommodation Stay Fee', amount: '', billing_cycle: 'monthly', section_scope: 'all', category: 'accommodation', description: 'Cash accommodation stay fee set by super admin.' });
    setShowPlan(true);
  }

  function openEditPlan(plan: Plan) {
    setPlanForm({ id: String(plan.id), name: plan.name, amount: String(plan.amount), billing_cycle: plan.billing_cycle, section_scope: plan.section_scope, category: plan.category, description: plan.description || '' });
    setShowPlan(true);
  }

  async function savePlan(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...planForm, amount: Number(planForm.amount), active: true };
      if (planForm.id) await apiFetch(`/admin/fees/plans/${planForm.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await apiFetch('/admin/fees/plans', { method: 'POST', body: JSON.stringify(payload) });
      setShowPlan(false);
      setToast({ tone: 'success', message: planForm.id ? 'Stay price updated.' : 'Stay price created.' });
      await load();
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not save stay price.' });
    } finally { setSaving(false); }
  }



  function openPayment(row: RegisterRow, mode: 'full' | 'partial') {
    if (!row.balance) {
      setToast({ tone: 'error', message: 'Set the stay price first before recording payment.' });
      return;
    }
    setPaymentTarget(row);
    setPaymentAmount(mode === 'full' ? String(row.balance) : '');
  }

  async function recordCashPayment(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentTarget) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setToast({ tone: 'error', message: 'Enter a valid cash amount.' });
      return;
    }
    if (amount > paymentTarget.balance) {
      setToast({ tone: 'error', message: 'Payment cannot exceed the remaining balance.' });
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/admin/fees/student-payment', { method: 'POST', body: JSON.stringify({ user_id: paymentTarget.student.id, amount, notes: amount >= paymentTarget.balance ? 'Full cash payment recorded by admin.' : 'Partial cash payment recorded by admin.' }) });
      setToast({ tone: 'success', message: `${paymentTarget.student.full_name || paymentTarget.student.email} payment recorded.` });
      setPaymentTarget(null);
      setPaymentAmount('');
      await load();
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not record cash payment.' });
    } finally { setSaving(false); }
  }

  return (
    <div className="section-shell fees-page">
      {toast ? <Toast tone={toast.tone} message={toast.message} onClose={() => setToast(null)} /> : null}

      <div className="page-header page-header-actions fees-hero">
        <div>
          <h1>Fees & Cash Payments</h1>
          <p>Super admin sets one stay price for everyone. Admins mark full or partial cash payments when students pay.</p>
        </div>
        <div className="inline-actions">
          {isSuperAdmin ? <button type="button" className="btn-outline" onClick={openCreatePlan}>Set Stay Price</button> : null}
        </div>
      </div>

      <div className="fees-action-strip compact">
        <div><strong>{students.length}</strong><span>approved students listed</span></div>
        <div><strong>{paidRows.length}</strong><span>fully paid and greyed out</span></div>
        <div><strong>{unpaidRows.length}</strong><span>unpaid or partially paid</span></div>
      </div>

      <div className="student-dash-tabs">
        <button type="button" className={activeTab === 'register' ? 'active' : ''} onClick={() => setActiveTab('register')}>Cash Register</button>
        <button type="button" className={activeTab === 'pricing' ? 'active' : ''} onClick={() => setActiveTab('pricing')}>Stay Pricing</button>
      </div>

      {activeTab === 'register' ? (
        <section className="section-outline fees-register-card">
          <div className="section-outline-header">
            <div><h2>Student Cash Payment Register</h2><p>Press `Mark Paid` only after cash has been received by the admin office.</p></div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter payments">
              <option value="all">All statuses</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="overdue">Overdue</option><option value="paid">Paid</option>
            </select>
          </div>
          {loading ? <div className="empty-state"><p>Loading students...</p></div> : !registerRows.length ? <div className="empty-state"><p>No approved students found.</p></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table className="fees-register-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: '#fafafa' }}>
                    {['Student', 'Email', 'Center', 'Paid', 'Balance', 'Payment Date', 'Status', 'Actions'].map((header) => (
                      <th key={header} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registerRows.map((row) => {
                    const { student, charge, plan, amount, paid, balance, effectiveStatus } = row;
                    const isPaid = effectiveStatus === 'paid';
                    return (
                      <tr key={student.id} className={`fee-register-row ${effectiveStatus}`} style={{ borderBottom: '1px solid var(--border)', background: isPaid ? '#f3f4f6' : 'white', color: isPaid ? 'var(--muted)' : 'inherit' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          <Link href={`/admin/profiles/${student.id}`} style={{ color: 'var(--green)' }}>{student.full_name || '—'}</Link>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{student.email}</td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{centerLabel(student.section)}</td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>{money(paid)}</td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap', fontWeight: 700 }}>{money(balance)}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{charge?.due_date ? new Date(charge.due_date).toLocaleDateString('en-GB') : '—'}</td>
                        <td style={{ padding: '0.75rem 1rem' }}><span className={`badge badge-${isPaid ? 'approved' : effectiveStatus === 'overdue' ? 'failed' : 'pending'}`}>{effectiveStatus}</span></td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {isPaid ? (
                            <span className="paid-chip">Cash paid</span>
                          ) : (
                            <div className="fee-row-menu-wrap">
                              {plan ? null : <span className="table-muted">Set stay price first</span>}
                              <button type="button" className="fee-row-menu-btn" onClick={() => setActionMenuRow(actionMenuRow?.student.id === student.id ? null : row)}>...</button>
                              {actionMenuRow?.student.id === student.id ? (
                                <div className="fee-row-menu">
                                  <button type="button" className="btn-primary" style={{ width: '100%' }} disabled={saving || !plan} onClick={() => { setActionMenuRow(null); openPayment(row, 'full'); }}>Paid</button>
                                  <button type="button" className="btn-outline" style={{ width: '100%' }} disabled={saving || !plan} onClick={() => { setActionMenuRow(null); openPayment(row, 'partial'); }}>Partial</button>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="section-outline">
          <div className="section-outline-header"><div><h2>Stay Pricing</h2><p>Only super admin can edit these amounts. Admins see the current price reflected here.</p></div></div>
          <div className="fees-plan-grid">
            {plans.map((plan) => (
              <article key={plan.id} className="fee-plan-card">
                <div><strong>{plan.name}</strong><span>{centerLabel(plan.section_scope)} · {plan.billing_cycle}</span></div>
                <h3>{money(plan.amount)}</h3>
                <p>{plan.description || 'No description set.'}</p>
                {isSuperAdmin ? <button type="button" className="btn-outline" onClick={() => openEditPlan(plan)}>Edit Price</button> : <span className="table-muted">Price controlled by super admin</span>}
              </article>
            ))}
            {!plans.length ? <div className="empty-state"><p>No stay pricing has been created yet.</p></div> : null}
          </div>
        </section>
      )}

      {paymentTarget ? (
        <div className="page-modal-backdrop" onClick={() => setPaymentTarget(null)}><div className="page-modal routine-modal" onClick={(e) => e.stopPropagation()}>
          <form className="form-stack routine-modal-form" onSubmit={recordCashPayment}>
            <div className="section-outline-header"><div><h2>Record Cash Payment</h2><p>{paymentTarget.student.full_name || paymentTarget.student.email} · Balance {money(paymentTarget.balance)}</p></div></div>
            <div className="field"><label>Cash Amount</label><input required type="number" min="1" max={paymentTarget.balance} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder="Enter partial or full amount" /></div>
            <div className="info-note">Use full amount for complete payment, or enter a smaller amount for partial payment. The student stays visible until balance is fully paid.</div>
            <div className="routine-modal-actions"><button type="button" className="btn-outline" onClick={() => setPaymentTarget(null)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Record Cash Payment'}</button></div>
          </form>
        </div></div>
      ) : null}

      {showPlan ? (
        <div className="page-modal-backdrop" onClick={() => setShowPlan(false)}><div className="page-modal routine-modal" onClick={(e) => e.stopPropagation()}>
          <form className="form-stack routine-modal-form" onSubmit={savePlan}>
            <div className="section-outline-header"><div><h2>{planForm.id ? 'Edit Stay Price' : 'Set Stay Price'}</h2><p>This amount reflects for every approved student immediately.</p></div></div>
            <div className="field"><label>Name</label><input required value={planForm.name} onChange={(e) => setPlanForm((c) => ({ ...c, name: e.target.value }))} /></div>
            <div className="field-grid"><div className="field"><label>Cash Amount</label><input required type="number" min="0" value={planForm.amount} onChange={(e) => setPlanForm((c) => ({ ...c, amount: e.target.value }))} /></div><div className="field"><label>Billing Cycle</label><select value={planForm.billing_cycle} onChange={(e) => setPlanForm((c) => ({ ...c, billing_cycle: e.target.value }))}><option value="monthly">Monthly</option><option value="termly">Termly</option><option value="yearly">Yearly</option><option value="once">Once</option></select></div></div>
            <div className="field-grid"><div className="field"><label>Center Scope</label>{isSuperAdmin ? <select value={planForm.section_scope} onChange={(e) => setPlanForm((c) => ({ ...c, section_scope: e.target.value }))}><option value="all">All Centers</option><option value="brothers">{BROTHERS_CENTER_NAME}</option><option value="sisters">{SISTERS_CENTER_NAME}</option></select> : <input value={user?.section === 'sisters' ? SISTERS_CENTER_NAME : BROTHERS_CENTER_NAME} disabled />}</div><div className="field"><label>Category</label><select value={planForm.category} onChange={(e) => setPlanForm((c) => ({ ...c, category: e.target.value }))}><option value="accommodation">Accommodation</option><option value="meal">Meal</option><option value="camp">Camp</option><option value="general">General</option></select></div></div>
            <div className="field"><label>Description</label><textarea rows={3} value={planForm.description} onChange={(e) => setPlanForm((c) => ({ ...c, description: e.target.value }))} /></div>
            <div className="routine-modal-actions"><button type="button" className="btn-outline" onClick={() => setShowPlan(false)}>Cancel</button><button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Price'}</button></div>
          </form>
        </div></div>
      ) : null}

    </div>
  );
}
