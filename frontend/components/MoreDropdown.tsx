'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type DropdownItem = {
  label: string;
  onClick: () => void;
  color?: string;
};

type MoreDropdownProps = {
  items: DropdownItem[];
};

export default function MoreDropdown({ items }: MoreDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        style={{ border: 'none', background: 'none', color: 'var(--muted)', fontSize: '1.2rem', fontWeight: 900, lineHeight: 1, cursor: 'pointer', padding: '0.2rem 0.3rem', letterSpacing: '0.1rem' }}
      >...</button>
      {open ? (
        <div style={{ position: 'absolute', right: 0, top: '32px', zIndex: 20, width: '140px', border: '1px solid var(--border)', borderRadius: '0.6rem', background: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { item.onClick(); setOpen(false); }}
              style={{ width: '100%', padding: '0.55rem 0.8rem', border: 'none', textAlign: 'left', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer', color: '#fff', background: item.color || '#6b7280', borderBottom: i < items.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}
            >{item.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
