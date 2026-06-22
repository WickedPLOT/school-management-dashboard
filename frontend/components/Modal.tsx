'use client';

import { useEffect, type ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
  fullScreen?: boolean;
};

export default function Modal({ open, onClose, children, maxWidth = '550px', fullScreen }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="page-modal-backdrop" onClick={onClose} style={fullScreen ? { padding: 0 } : undefined}>
      <div className="page-modal" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: fullScreen ? '100vw' : maxWidth,
        width: fullScreen ? '100vw' : undefined,
        height: fullScreen ? '100vh' : undefined,
        borderRadius: fullScreen ? 0 : undefined,
        border: fullScreen ? 'none' : undefined,
      }}>
        {children}
      </div>
    </div>
  );
}
