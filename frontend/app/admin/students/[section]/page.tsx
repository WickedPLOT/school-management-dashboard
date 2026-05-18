'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import SuperAdminSectionView from '@/components/SuperAdminSectionView';

export default function SuperAdminSectionPage() {
  const params = useParams<{ section: string }>();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const section = params?.section === 'brothers' || params?.section === 'sisters' ? params.section : null;

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (!stored) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(stored);
      if (user.role !== 'super_admin') {
        router.push('/admin/dashboard');
        return;
      }
      setAllowed(true);
    } catch {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    if (!section) router.push('/admin/dashboard');
  }, [router, section]);

  if (!section) return null;

  if (allowed !== true) return null;

  return <SuperAdminSectionView section={section} />;
}
