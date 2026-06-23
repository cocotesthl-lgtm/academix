'use client';

import { useState, useTransition } from 'react';
import { blockTenantAction } from '@/lib/users/blocks';

/**
 * Card de sitio en el panel del afiliado/instructor. Click en el cuerpo
 * abre el panel del tenant. Botón ⋮ abre menú con "Bloquear sitio".
 *
 * Al bloquear:
 *  1. Desactiva memberships del user en ese tenant
 *  2. Limpia asignaciones de publicaciones como instructor
 *  3. La sitio ya no puede re-sumarlo (filtro silencioso en addInstructorAction)
 *  4. Acción reversible desde la sección "Bloqueadas"
 */
export function TenantCard({
  tenant,
  href,
  accent,
  children
}: {
  tenant: { id: string; slug: string; name: string };
  href: string;
  accent: string;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();

  function block() {
    if (!confirm(
      `¿Bloquear "${tenant.name}"?\n\n` +
      'La sitio no va a poder volver a sumarte como instructor ni vas ' +
      'a aparecerle en ninguna lista. Tu rol de afiliado en esa sitio ' +
      'también se desactiva.\n\n' +
      'Podés desbloquear cuando quieras desde la sección "Bloqueadas".'
    )) return;
    const fd = new FormData();
    fd.set('tenant_id', tenant.id);
    start(async () => { await blockTenantAction(fd); });
  }

  return (
    <div className="relative">
      <a
        href={href}
        className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/30 hover:bg-white/[0.04] transition"
        style={{ '--accent': accent } as React.CSSProperties}
      >
        {children}
      </a>
      {/* Menú ⋮ overlay */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setMenuOpen((o) => !o); }}
        className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10"
        aria-label="Más opciones"
      >
        ⋮
      </button>
      {menuOpen && (
        <>
          {/* Overlay para cerrar al clickear afuera */}
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-10 right-2 z-20 w-52 rounded-lg border border-white/15 bg-[#111] shadow-2xl py-1">
            <button
              type="button"
              onClick={() => { setMenuOpen(false); block(); }}
              disabled={pending}
              className="w-full text-left px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50"
            >
              🚫 Bloquear sitio
            </button>
            <p className="text-[10px] text-white/40 px-3 py-1.5 leading-snug">
              Te saca de la sitio. No pueden volver a sumarte.
              Reversible.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
