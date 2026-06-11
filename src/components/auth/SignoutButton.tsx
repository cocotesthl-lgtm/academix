'use client';

import { useTransition } from 'react';
import { signoutAction } from '@/lib/auth/actions';

export function SignoutButton({ className, icon = false, redirectTo }: { className?: string; icon?: boolean; redirectTo?: string }) {
  const [pending, start] = useTransition();
  if (icon) {
    return (
      <button
        type="button"
        onClick={() => start(() => signoutAction(redirectTo))}
        disabled={pending}
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
        className={className ?? 'shrink-0 rounded p-1 text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-50 transition'}
      >
        {pending ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        )}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => start(() => signoutAction(redirectTo))}
      disabled={pending}
      className={className ?? 'text-sm text-white/60 hover:text-white disabled:opacity-50'}
    >
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}
