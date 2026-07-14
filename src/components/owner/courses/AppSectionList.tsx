'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Sparkline } from '@/components/owner/Sparkline';

/**
 * Lista genérica dentro de cada AppSection en /owner/courses.
 * Client component para tener buscador + "Mostrar todos" con estado local.
 *
 * Sin paginación real: muestra los primeros 5 y un botón que expande.
 * Suficiente cuando la mayoría de owners tienen <20 productos por app.
 */

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  /** Solo para físicos */
  stock_qty?: number;
  /** Para stats de courses (clientes, revenue, sparkline) */
  clients?: number;
  revenue?: number;
  trend?: number[];
  /** href a donde ir al hacer click en el título / editar */
  editHref: string;
};

const INITIAL_ROWS = 5;

export function AppSectionList({
  rows,
  kind
}: {
  rows: Row[];
  /** 'courses' muestra clientes+revenue+sparkline; 'physical' muestra stock. */
  kind: 'courses' | 'physical' | 'bundles';
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);
  const hiddenCount = filtered.length - visible.length;

  return (
    <div>
      {rows.length > INITIAL_ROWS && (
        <div className="px-5 py-2.5 border-b border-white/5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Buscar por título o slug…"
            className="w-full sm:w-72 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-white/45 text-[10px] uppercase tracking-wider bg-white/[0.02]">
          <tr>
            <th className="text-left px-5 py-2">Título</th>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-left px-3 py-2">Precio</th>
            {kind === 'courses' && (<>
              <th className="text-right px-3 py-2">Clientes</th>
              <th className="text-right px-3 py-2">Recaudado</th>
              <th className="text-right px-3 py-2">Últ. 30d</th>
            </>)}
            {kind === 'physical' && <th className="text-right px-3 py-2">Stock</th>}
            <th className="text-right px-5 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={kind === 'courses' ? 7 : 5} className="px-5 py-6 text-center text-sm text-white/40">
                No hay resultados para "{query}".
              </td>
            </tr>
          )}
          {visible.map((r) => (
            <tr key={r.id} className="border-t border-white/5 hover:bg-white/[0.02]">
              <td className="px-5 py-3">
                <Link href={r.editHref} className="font-medium hover:underline">{r.title}</Link>
                <div className="text-xs text-white/40">/{r.slug}</div>
              </td>
              <td className="px-3 py-3"><StatusChip s={r.status} /></td>
              <td className="px-3 py-3 text-white/80">
                {r.price_cents === 0 ? 'Gratis' : `${(r.price_cents / 100).toLocaleString('es-AR')} ${r.currency}`}
              </td>
              {kind === 'courses' && (<>
                <td className="px-3 py-3 text-right font-medium">{r.clients ?? 0}</td>
                <td className="px-3 py-3 text-right font-mono">
                  {(r.revenue ?? 0) > 0
                    ? <span className="text-emerald-300">${((r.revenue ?? 0) / 100).toLocaleString('es-AR')}</span>
                    : <span className="text-white/30">—</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  {r.trend && r.trend.some((v) => v > 0)
                    ? <Sparkline values={r.trend} color="#10b981" width={80} height={22} className="inline-block" />
                    : <span className="text-white/25 text-xs">sin ventas</span>}
                </td>
              </>)}
              {kind === 'physical' && (
                <td className="px-3 py-3 text-right text-white/70">{r.stock_qty ?? 0}</td>
              )}
              <td className="px-5 py-3 text-right">
                <Link href={r.editHref} className="text-xs text-white/60 hover:text-white">Editar →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hiddenCount > 0 && (
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] text-center">
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="text-xs text-white/70 hover:text-white underline underline-offset-2"
          >
            Mostrar todos ({hiddenCount} más) ↓
          </button>
        </div>
      )}
      {showAll && rows.length > INITIAL_ROWS && (
        <div className="px-5 py-3 border-t border-white/5 bg-white/[0.01] text-center">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className="text-xs text-white/50 hover:text-white/80"
          >
            Colapsar ↑
          </button>
        </div>
      )}
    </div>
  );
}

function StatusChip({ s }: { s: string }) {
  const cls = s === 'published'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : s === 'archived'
      ? 'border-white/15 text-white/40'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded border ${cls}`}>{s}</span>;
}
