'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';

export default function OAuthCallbackPage() {
  const { completeOAuthLogin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const ok = await completeOAuthLogin();
      if (ok) router.replace('/dashboard');
      else router.replace('/login?error=oauth');
    })();
  }, [router, completeOAuthLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-gray-500">Signing you in…</p>
      </div>
    </div>
  );
}
