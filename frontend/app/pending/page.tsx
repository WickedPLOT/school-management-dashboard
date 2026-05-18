export default function PendingPage() {
  return (
    <div className="pending-wrap">
      <div className="pending-card">
        <div className="pending-icon-wrap">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2>Registration Submitted</h2>
        <p>Your application has been received. An admin will review and approve your account. You will be able to log in once approved.</p>
        <a href="/login" className="btn-back">Back to Login</a>
      </div>
    </div>
  );
}
