'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CommandPalette, CommandPaletteTrigger } from './CommandPalette';
import { ToastBus } from './ToastBus';

/**
 * Layout shell del owner panel — wrapper client-side que maneja:
 *  - Sidebar fija a la izquierda en desktop (lg+)
 *  - Sidebar como drawer overlay en mobile (<lg) con backdrop
 *  - Hamburger en topbar mobile para abrir/cerrar
 *  - Auto-cerrar drawer al navegar (cambio de pathname)
 *  - Click fuera del drawer también cierra
 *
 * El server-side OwnerLayout solo arma el HTML, este componente le pone
 * el comportamiento interactivo encima.
 */
export function OwnerShell({
  brandName,
  storefrontUrl,
  sidebar,
  children
}: {
  brandName: string;
  storefrontUrl: string;
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Sidebar colapsado en desktop. Persiste en localStorage.
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setOpen(false); }, [pathname]);

  // Cargar preferencia de colapsado (desktop)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cp-sidebar-collapsed');
      if (saved === '1') setCollapsed(true);
    } catch { /* SSR / privacy mode */ }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('cp-sidebar-collapsed', next ? '1' : '0'); } catch {/* */}
      return next;
    });
  }

  // Body lock cuando drawer abierto en mobile
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <div
      data-ui-theme="dark"
      data-sidebar-collapsed={collapsed ? 'true' : 'false'}
      className="min-h-screen bg-[#1c1d1f] text-white"
      style={{ ['--cp-sidebar-w' as string]: collapsed ? '4rem' : '16rem' }}
    >
      <CommandPalette storefrontUrl={storefrontUrl} />
      <ToastBus />
      {/* Mobile topbar — visible solo <lg */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center gap-2 px-3 py-2 bg-[#1c1d1f]/95 backdrop-blur border-b border-white/10">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="w-9 h-9 grid place-items-center rounded-lg hover:bg-white/5 active:bg-white/10"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="font-semibold text-sm truncate flex-1">{brandName}</div>
        <CommandPaletteTrigger compact />
      </header>

      <div className="flex">
        {/* Backdrop (mobile, solo cuando open) */}
        {open && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar menú"
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
          />
        )}

        {/* Sidebar grafito — desktop static / mobile drawer */}
        <aside
          className={`
            ${collapsed ? 'lg:w-16 lg:p-2' : 'lg:w-64 lg:p-4'} w-64 p-4
            border-r border-white/10 flex flex-col bg-[#1c1d1f]
            lg:sticky lg:top-0 lg:h-screen lg:translate-x-0
            fixed inset-y-0 left-0 z-50
            transition-[transform,width,padding] duration-200 ease-out
            ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            relative
          `}
        >
          {sidebar}
          {/* Toggle colapsar/expandir — sólo desktop, sobresale al borde */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="hidden lg:flex absolute -right-3 top-20 z-10 w-6 h-6 items-center justify-center rounded-full border border-white/15 bg-[#1c1d1f] text-white/60 hover:text-white hover:border-white/40 hover:bg-[#252628] transition shadow-md"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </aside>

        {/* Main — área de contenido en light theme (estilo Wix) */}
        <main
          data-cp-content="light"
          data-ui-theme="light"
          className="flex-1 min-w-0 bg-[#f5f5f7] text-[#1a1a1a] min-h-screen"
        >
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
