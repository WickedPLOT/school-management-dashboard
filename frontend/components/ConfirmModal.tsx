'use client';
import { useEffect } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', confirmColor = '#dc2626', onConfirm, onCancel }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>{title}</h3>
        <p style={{ margin: '0 0 1.25rem', fontSize: '0.85rem', color: '#555' }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '0.5rem 1rem', border: '1px solid var(--border)', borderRadius: '0.375rem', background: 'white', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '0.375rem', background: confirmColor, color: 'white', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
