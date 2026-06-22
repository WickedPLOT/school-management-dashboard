'use client';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Yes, continue',
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="page-modal-backdrop" onClick={onCancel}>
      <div className="page-modal confirm-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="confirm-dialog-body">
          <h2>{title}</h2>
          <p>{message}</p>
          <div className="event-actions confirm-dialog-actions">
            <button type="button" className="btn-outline" onClick={onCancel} disabled={loading}>{cancelLabel}</button>
            <button type="button" className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={loading}>
              {loading ? 'Working...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
