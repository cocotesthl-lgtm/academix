'use client';

import { useState, useEffect, useRef } from 'react';
import type { Workspace } from '@/lib/workspaces/queries';

/**
 * Header del panel del afiliado (F6.1).
 *
 * Muestra el badge de contexto ("Estás en <Tenant> como Afiliado") +
 * dropdown para cambiar a otro workspace del user. Es la contraparte
 * del WorkspaceSwitcher del owner sidebar, adaptada al panel affiliate
 * que vive dentro del layout del storefront.
 */
export function AffiliateWorkspaceHeader({
  currentTenantName,
  currentTenantLogo,
  currentBrand,
  workspaces,
  currentTenantId,
  email
}: {
  currentTenantName: string;
  currentTenantLogo: string | null;
  currentBrand: string;
  workspaces: Workspace[];
  currentTenantId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const others = workspaces.filter((w) => w.tenant_id !== currentTenantId);

  return (
    <div className="mb-6 rounded-xl border border-black/10 bg-black text-white p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {currentTenantLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentTenantLogo} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded grid place-items-center font-bold shrink-0"
              style={{ background: currentBrand }}>
              {currentTenantName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-white/50 font-semibold">
              Panel del afiliado
            </div>
            <div className="font-semibold truncate">
              {currentTenantName}
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-white/15 uppercase tracking-wider">Afiliado</span>
            </div>
            <div className="text-[10px] text-white/45 truncate">{email}</div>
          </div>
        </div>

        <div ref={ref} className="relative">
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="text-xs px-3 py-2 rounded border border-white/20 hover:bg-white/10 flex items-center gap-1.5">
            <span>Cambiar workspace</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-1 z-40 min-w-[240px] rounded-lg border border-white/15 bg-[#1c1c1c] shadow-xl overflow-hidden">
              {others.length === 0 ? (
                <div className="px-3 py-3 text-xs text-white/50">
                  Este es tu único workspace por ahora.
                </div>
              ) : (
                <ul className="max-h-72 overflow-y-auto">
                  {others.map((w) => (
                    <li key={w.tenant_id}>
                      <a href={w.href} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5">
                        {w.logo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={w.logo_url} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded grid place-items-center text-xs font-bold shrink-0"
                            style={{ background: w.brand_primary ?? '#f97316' }}>
                            {w.tenant_name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{w.tenant_name}</div>
                          <div className="text-[10px] text-white/45 capitalize">{roleLabel(w.role)}</div>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function roleLabel(role: Workspace['role']): string {
  switch (role) {
    case 'owner': return 'Propietario';
    case 'instructor': return 'Instructor';
    case 'affiliate': return 'Afiliado';
    case 'student': return 'Alumno';
  }
}
