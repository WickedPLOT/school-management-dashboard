'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Charge = { id: number; plan_name?: string; category?: string; amount: number; paid_amount: number; balance: number; due_date: string; effective_status: string; note?: string };
type Payment = { id: number; amount: number; payment_method: string; paid_at: string; plan_name?: string; notes?: string };
type FeeData = { charges: Charge[]; payments: Payment[]; summary: { total_billed: number; total_paid: number; outstanding: number; next_due: Charge | null } };

const money = (value: number | string | null | undefined) => `KES ${Number(value || 0).toLocaleString()}`;

export default function Page() {
  const [data, setData] = useState<FeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try { setData(await apiFetch('/profile/fees')); }
      catch (err) { setError(err instanceof Error ? err.message : 'Could not load fees.'); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  if (loading) return <div className="empty-state"><p>Loading fees...</p></div>;
  if (error) return <div className="error-msg">{error}</div>;

  const summary = data?.summary;
  const nextDue = summary?.next_due;

  return (
    <div className="section-shell fees-page student-fees-page">
      <div className="page-header fees-hero">
        <h1>My Stay Fees</h1>
        <p>View your accommodation stay charge. Payments are made in cash and confirmed by the admin office.</p>
      </div>

      <div className="stats-grid fees-stats">
        <div className="stat-card"><div><h3>{money(summary?.total_billed)}</h3><p>Total billed</p></div></div>
        <div className="stat-card"><div><h3>{money(summary?.total_paid)}</h3><p>Cash paid</p></div></div>
        <div className="stat-card"><div><h3>{money(summary?.outstanding)}</h3><p>Outstanding</p></div></div>
      </div>

      <section className="section-outline next-fee-card">
        <div className="section-outline-header"><div><h2>Next Due Payment</h2><p>Pay cash to the admin office. Your account updates after the admin marks it paid.</p></div></div>
        {nextDue ? (
          <div className="student-next-due">
            <div><span>{nextDue.plan_name || 'Stay fee'}</span><strong>{money(nextDue.balance)}</strong></div>
            <div><span>Due date</span><strong>{new Date(nextDue.due_date).toLocaleDateString('en-GB')}</strong></div>
            <div><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{nextDue.effective_status}</strong></div>
          </div>
        ) : <div className="empty-state"><p>No outstanding fees.</p></div>}
      </section>

      <section className="section-outline">
        <div className="section-outline-header"><div><h2>Assigned Fees</h2><p>All stay fees assigned to you and their current cash payment status.</p></div></div>
        {!data?.charges.length ? <div className="empty-state"><p>No fee charges assigned yet.</p></div> : (
          <div className="fees-card-list">
            {data.charges.map((charge) => (
              <article key={charge.id} className={`fee-student-card ${charge.effective_status}`}>
                <div className="fee-student-main"><strong>{charge.plan_name || 'Stay fee'}</strong><span>{charge.category || 'accommodation'} · due {new Date(charge.due_date).toLocaleDateString('en-GB')}</span></div>
                <div className="fee-money-grid">
                  <div><span>Billed</span><strong>{money(charge.amount)}</strong></div>
                  <div><span>Cash paid</span><strong>{money(charge.paid_amount)}</strong></div>
                  <div><span>Balance</span><strong>{money(charge.balance)}</strong></div>
                </div>
                <div className="fee-card-actions"><span className={`badge badge-${charge.effective_status === 'paid' ? 'approved' : charge.effective_status === 'overdue' ? 'failed' : 'pending'}`}>{charge.effective_status}</span></div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="section-outline">
        <div className="section-outline-header"><div><h2>Cash Payment History</h2><p>Payments confirmed by the admin office.</p></div></div>
        {!data?.payments.length ? <div className="empty-state"><p>No cash payments recorded yet.</p></div> : (
          <div className="panel-table-wrap"><table className="panel-table"><thead><tr><th>Fee</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead><tbody>{data.payments.map((payment) => (<tr key={payment.id}><td>{payment.plan_name || 'Fee'}</td><td>{money(payment.amount)}</td><td>{payment.payment_method}</td><td>{new Date(payment.paid_at).toLocaleString('en-GB')}</td></tr>))}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
