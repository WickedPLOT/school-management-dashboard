'use client';
import { Suspense } from 'react';
import RegisterForm from './RegisterForm';

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </div>
    }>
      <RegisterForm />
    </Suspense>
  );
}
