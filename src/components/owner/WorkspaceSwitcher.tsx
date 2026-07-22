'use client';

import { useEffect, useRef, useState } from 'react';

type Workspace = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: 'owner' | 'instructor' | 'student' | 'affiliate';
  brand_primary: string | null;
  logo_url: string | null;
  href: string;     // URL absoluta al panel correcto según rol
};

const ROLE_LABEL: Record<Workspace['role'], string> = {
  owner: 'Propietario',
  instructor: 'Instructor',
  affiliate: 'Afiliado',
  student: 'Alumno'
};

/**
 * Switcher de workspaces (estilo Wix): card grande clickeable arriba del
 * sidebar que muestra el workspace actual + dropdown con todos los demás
 * + CTA crear nuevo + signout.
 */
export function WorkspaceSwitcher({
  currentName,
  currentLogo,
  currentBrand,
  email,
  workspaces,
  currentTenantId,
  onboardingUrl
}: {
  currentName: string;
  currentLogo: string | null;
  currentBrand: string;
  email: string;
  workspaces: Workspace[];
  currentTenantId: string;
  onboardingUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click fuera → cerrar
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const others = workspaces.filter((w) => w.tenant_id !== currentTenantId);

  return (
    <div ref={ref} className="relative">
      {/* Trigger: card grande con workspace actual */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-lg p-2 hover:bg-white/5 transition text-left"
      >
        {currentLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentLogo} alt="" className="w-9 h-9 rounded-md object-cover border border-white/10 shrink-0" />
        ) : (
          <div
            className="w-9 h-9 rounded-md grid place-items-center font-bold text-white border border-white/10 shrink-0 text-sm"
            style={{ background: currentBrand }}
          >
            {currentName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{currentName}</div>
          <div className="text-[10px] text-white/45 truncate">{email}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-white/15 bg-[#252628] shadow-xl overflow-hidden">
          {others.length > 0 && (
            <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-widest text-white/40 font-semibold">
              Cambiar de sitio
            </div>
          )}
          <div className="max-h-72 overflow-y-auto">
            {others.map((w) => (
              <a
                key={w.tenant_id}
                href={w.href}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition"
              >
                {w.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.logo_url} alt="" className="w-7 h-7 rounded object-cover border border-white/10 shrink-0" />
                ) : (
                  <div
                    className="w-7 h-7 rounded grid place-items-center font-bold text-white border border-white/10 shrink-0 text-xs"
                    style={{ background: w.brand_primary ?? '#f97316' }}
                  >
                    {w.tenant_name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{w.tenant_name}</div>
                  <div className="text-[10px] text-white/45 truncate">{ROLE_LABEL[w.role]}</div>
                </div>
              </a>
            ))}
          </div>

          <div className="border-t border-white/10">
            <a
              href="/mis-sitios"
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-sm transition"
            >
              <span className="w-7 h-7 rounded grid place-items-center border border-white/25 text-white/50 shrink-0">⚙</span>
              <span>Gestionar mis sitios</span>
            </a>
            <a
              href={onboardingUrl}
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-white/5 text-sm transition"
            >
              <span className="w-7 h-7 rounded grid place-items-center border border-dashed border-white/25 text-white/50 shrink-0">+</span>
              <span>Crear un nuevo sitio</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
