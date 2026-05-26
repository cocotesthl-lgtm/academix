'use client';

import { useTransition } from 'react';
import { signoutAction } from '@/lib/auth/actions';

export function SignoutButton({ className }: { className?: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => signoutAction())}
      disabled={pending}
      className={className ?? 'text-sm text-white/60 hover:text-white disabled:opacity-50'}
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
