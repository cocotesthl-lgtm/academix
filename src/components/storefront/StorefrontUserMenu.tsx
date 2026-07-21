'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { signoutAction } from '@/lib/auth/actions';

/**
 * Indicador de sesión en el header del storefront.
 *
 * - Sin login → botón "Iniciar sesión" tradicional
 * - Con login → avatar con inicial del email → dropdown con:
 *     · Mi panel (workspaces si tiene varios, o el panel directo si tiene uno)
 *     · Mis publicaciones (si es alumno acá)
 *     · Cerrar sesión
 */
export function StorefrontUserMenu({
  loggedIn,
  email,
  primary,
  loginHref,
  panelHref,
  hasEnrollments,
  signoutRedirect
}: {
  loggedIn: boolean;
  email: string;
  primary: string;
  loginHref: string;
  panelHref: string;       // a dónde ir cuando click "Mi panel"
  hasEnrollments: boolean; // si tiene cursos comprados acá
  signoutRedirect: string; // a dónde ir después del signout (storefront)
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!loggedIn) {
    return (
      <a
        href={loginHref}
        className="rounded-md text-sm font-medium px-4 py-2 text-white whitespace-nowrap"
        style={{ background: `var(--brand-bg, ${primary})` }}
      >
        Iniciar sesión
      </a>
    );
  }

  const initial = (email[0] ?? '?').toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={email}
        className="flex items-center gap-1.5 rounded-full p-0.5 pr-2 hover:bg-black/5 transition"
      >
        <div
          className="w-9 h-9 rounded-full grid place-items-center text-white font-bold text-sm shrink-0"
          style={{ background: `var(--brand-bg, ${primary})` }}
        >
          {initial}
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-black/40 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[220px] rounded-lg border border-black/10 bg-white shadow-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-black/5">
            <div className="text-[10px] uppercase tracking-wider text-black/45 font-semibold">Sesión activa</div>
            <div className="text-xs text-black/70 truncate" title={email}>{email}</div>
          </div>

          <a href={panelHref} className="flex items-center gap-2 px-3 py-2.5 hover:bg-black/5 text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            Mi panel
          </a>

          {hasEnrollments && (
            <a href="/learn" className="flex items-center gap-2 px-3 py-2.5 hover:bg-black/5 text-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Mis publicaciones
            </a>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => signoutAction(signoutRedirect))}
            className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-black/5 text-sm text-black/70 border-t border-black/5 disabled:opacity-50 text-left"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            {pending ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </div>
  );
}
