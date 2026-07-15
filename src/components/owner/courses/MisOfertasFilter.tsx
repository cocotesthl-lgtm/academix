'use client';

import { useEffect, useState } from 'react';

/**
 * Barra de filtros para Mis ofertas: Activas (default) / Todas / No activas.
 *
 * En vez de mover la lista de secciones a un client component (que
 * obligaría a serializar toda la data del server), este componente
 * escribe un `data-filter` en el contenedor `#mis-ofertas-sections` y
 * un <style> inline esconde las secciones cuyo `data-mod-active` no
 * matchea. Las secciones siguen siendo server-rendered.
 */
export function MisOfertasFilter() {
  const [filter, setFilter] = useState<'active' | 'all' | 'off'>('active');

  useEffect(() => {
    const root = document.getElementById('mis-ofertas-sections');
    if (root) root.dataset.filter = filter;
  }, [filter]);

  return (
    <>
      <style>{`
        #mis-ofertas-sections[data-filter="active"] > [data-mod-active="false"] { display: none; }
        #mis-ofertas-sections[data-filter="off"] > [data-mod-active="true"] { display: none; }
      `}</style>
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === 'active'} onClick={() => setFilter('active')}>Activas</Chip>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Todas</Chip>
        <Chip active={filter === 'off'} onClick={() => setFilter('off')}>No activas</Chip>
      </div>
    </>
  );
}

function Chip({
  active, onClick, children
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition ${
        active
          ? 'bg-white text-black font-semibold dark:bg-white dark:text-black'
          : 'border border-black/15 text-black/70 hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/5'
      }`}
    >
      {children}
    </button>
  );
}
