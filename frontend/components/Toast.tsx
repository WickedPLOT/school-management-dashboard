'use client';

type ToastProps = {
  message: string;
  tone?: 'success' | 'error';
  onClose?: () => void;
};

export default function Toast({ message, tone = 'success', onClose }: ToastProps) {
  return (
    <div className={`app-toast app-toast-${tone}`}>
      <div>
        <strong>{tone === 'success' ? 'Success' : 'Error'}</strong>
        <p>{message}</p>
      </div>
      {onClose ? <button type="button" onClick={onClose} aria-label="Close notification">×</button> : null}
    </div>
  );
}
