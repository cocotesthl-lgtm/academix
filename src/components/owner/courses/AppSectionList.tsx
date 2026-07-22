'use client';

import Link from 'next/link';
import { useState, useMemo, useTransition } from 'react';
import { Sparkline } from '@/components/owner/Sparkline';
import { bulkDeleteItemsAction, duplicateItemAction } from '@/lib/items/actions';

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
  /** Thumbnail visible al lado del título (cover_url del producto). */
  cover_url?: string | null;
  /** Solo para físicos */
  stock_qty?: number;
  /** SKU — se muestra debajo del slug y se incluye en el buscador. */
  sku?: string | null;
  /** Para stats de courses (clientes, revenue, sparkline) */
  clients?: number;
  revenue?: number;
  trend?: number[];
  /** Solo para articles — timestamp ISO de última edición */
  updated_at?: string | null;
  /** href a donde ir al hacer click en el título / editar */
  editHref: string;
};

const INITIAL_ROWS = 5;

export function AppSectionList({
  rows,
  kind,
  dimmed = false
}: {
  rows: Row[];
  /** 'courses' muestra clientes+revenue+sparkline; 'physical' muestra stock;
   *  'articles' muestra "Última edición" en vez de precio/stats;
   *  'paylinks' muestra pagos + recaudado. */
  kind: 'courses' | 'physical' | 'bundles' | 'articles' | 'paylinks';
  /**
   * Cuando true (app desactivada), la lista arranca oculta detrás de un
   * botón "Mostrar contenido guardado" y cada row muestra el chip como
   * `inactivo` sin importar el status real — contenido de una app off
   * no es de interés a priori pero se preserva por si el owner reactiva.
   */
  dimmed?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState(!dimmed);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function clearSelection() { setSelected(new Set()); }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`¿Eliminar ${ids.length} ${ids.length === 1 ? 'item' : 'items'}? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set('kind', kind);
      fd.set('ids', ids.join(','));
      await bulkDeleteItemsAction(fd);
      clearSelection();
    });
  }

  async function handleDuplicate() {
    if (selected.size !== 1) return;
    const [id] = Array.from(selected);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('kind', kind);
      fd.set('id', id);
      await duplicateItemAction(fd);
      clearSelection();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.title.toLowerCase().includes(q) ||
      r.slug.toLowerCase().includes(q) ||
      (r.sku ? r.sku.toLowerCase().includes(q) : false)
    );
  }, [rows, query]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);
  const hiddenCount = filtered.length - visible.length;

  // ⚠️ El early return va DESPUÉS de todos los hooks — si no, al pulsar
  // "Mostrar contenido" cambiaba la cantidad de hooks entre renders y
  // React crasheaba la pestaña entera ("This page couldn't load").
  if (dimmed && !revealed) {
    return (
      <div className="px-5 py-4 text-center border-t border-white/5 bg-white/[0.01]">
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="text-xs text-white/60 hover:text-white underline underline-offset-2"
        >
          Mostrar contenido guardado ({rows.length}) ↓
        </button>
      </div>
    );
  }

  return (
    <div>
      {rows.length > INITIAL_ROWS && (
        <div className="px-5 py-2.5 border-b border-white/5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Buscar por título, slug o SKU…"
            className="w-full sm:w-72 rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-xs placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
      )}

      {/* Bulk action bar — visible cuando hay al menos 1 seleccionado */}
      {selected.size > 0 && (
        <div className="px-5 py-2 border-b border-white/10 bg-emerald-500/[0.06] flex items-center gap-3 flex-wrap">
          <span className="text-xs text-emerald-200 font-medium">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={handleDuplicate}
              disabled={pending || selected.size !== 1}
              title={selected.size !== 1 ? 'Duplicar solo funciona con 1 seleccionado' : 'Duplicar item'}
              className="text-xs px-2.5 py-1 rounded border border-white/15 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed">
              ⧉ Duplicar
            </button>
            <button type="button" onClick={handleBulkDelete} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-40">
              🗑 Eliminar
            </button>
            <button type="button" onClick={clearSelection} disabled={pending}
              className="text-xs px-2 py-1 text-white/50 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="text-white/45 text-[10px] uppercase tracking-wider bg-white/[0.02]">
          <tr>
            <th className="text-left pl-5 pr-1 py-2 w-6">
              <input
                type="checkbox"
                checked={visible.length > 0 && visible.every((r) => selected.has(r.id))}
                onChange={(e) => {
                  const next = new Set(selected);
                  if (e.currentTarget.checked) {
                    for (const r of visible) next.add(r.id);
                  } else {
                    for (const r of visible) next.delete(r.id);
                  }
                  setSelected(next);
                }}
                className="w-3.5 h-3.5 cursor-pointer align-middle"
                title="Seleccionar todos los visibles"
              />
            </th>
            <th className="text-left px-3 py-2">Título</th>
            <th className="text-left px-3 py-2">Estado</th>
            {kind !== 'articles' && <th className="text-left px-3 py-2">Precio</th>}
            {kind === 'courses' && (<>
              <th className="text-right px-3 py-2">Clientes</th>
              <th className="text-right px-3 py-2">Recaudado</th>
              <th className="text-right px-3 py-2">Últ. 30d</th>
            </>)}
            {kind === 'physical' && <th className="text-right px-3 py-2">Stock</th>}
            {kind === 'articles' && <th className="text-right px-3 py-2">Última edición</th>}
            {kind === 'paylinks' && (<>
              <th className="text-right px-3 py-2">Pagos</th>
              <th className="text-right px-3 py-2">Recaudado</th>
            </>)}
            <th className="text-right px-5 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 && (
            <tr>
              <td colSpan={kind === 'courses' ? 8 : kind === 'articles' ? 5 : kind === 'paylinks' ? 7 : 6} className="px-5 py-6 text-center text-sm text-white/40">
                No hay resultados para "{query}".
              </td>
            </tr>
          )}
          {visible.map((r) => (
            <tr key={r.id} className={`border-t border-white/5 hover:bg-white/[0.02] ${selected.has(r.id) ? 'bg-emerald-500/[0.04]' : ''}`}>
              <td className="pl-5 pr-1 py-3 align-middle">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleOne(r.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-3.5 h-3.5 cursor-pointer"
                />
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Thumbnail — 40x40, fallback a un placeholder gris cuando el producto no tiene foto */}
                  {r.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_url} alt="" className="w-10 h-10 rounded object-cover bg-white/5 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-white/5 border border-white/10 flex items-center justify-center text-white/25 text-xs shrink-0">
                      —
                    </div>
                  )}
                  <div className="min-w-0">
                    <Link href={r.editHref} className="font-medium hover:underline block truncate">{r.title}</Link>
                    <div className="text-xs text-white/40 truncate">
                      /{r.slug}
                      {r.sku && <span className="ml-2 font-mono">SKU: {r.sku}</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3"><StatusChip s={dimmed ? 'inactivo' : r.status} /></td>
              {kind !== 'articles' && (
                <td className="px-3 py-3 text-white/80">
                  {r.price_cents === 0 ? 'Gratis' : `${(r.price_cents / 100).toLocaleString('es-AR')} ${r.currency}`}
                </td>
              )}
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
              {kind === 'articles' && (
                <td className="px-3 py-3 text-right text-white/50 text-xs">
                  {r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                </td>
              )}
              {kind === 'paylinks' && (<>
                <td className="px-3 py-3 text-right font-medium">{r.clients ?? 0}</td>
                <td className="px-3 py-3 text-right font-mono">
                  {(r.revenue ?? 0) > 0
                    ? <span className="text-emerald-300">${((r.revenue ?? 0) / 100).toLocaleString('es-AR')}</span>
                    : <span className="text-white/30">—</span>}
                </td>
              </>)}
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
    : s === 'archived' || s === 'inactivo'
      ? 'border-white/15 text-white/40'
      : 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  return <span className={`inline-block text-xs px-2 py-0.5 rounded border ${cls}`}>{s}</span>;
}
