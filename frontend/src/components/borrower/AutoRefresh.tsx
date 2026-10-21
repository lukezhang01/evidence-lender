'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const POLL_MS = 3000;

// Re-fetches the page while it waits on something another person does.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
