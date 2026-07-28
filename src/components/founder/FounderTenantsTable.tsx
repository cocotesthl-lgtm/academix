'use client';

import { useState, useMemo, useTransition } from 'react';
import { impersonateTenantAction } from '@/lib/founder/actions';
import { SettleDebtButton } from './SettleDebtButton';
import { ReprocessPaymentButton } from './ReprocessPaymentButton';
import { DeleteTenantButton } from './DeleteTenantButton';
import { bulkUpdateTenantsAction } from '@/lib/founder/moderation';

type Row = {
  id: string;
  slug: string;
  name: string;
  status: string; // 'active' | 'under_review' | 'suspended' | 'closed'
  created_at: string;
  commission_rate_override: number | null;
  ownerName: string | null;
  ownerEmail: string | null;
  balance: number; // cents
};

export function FounderTenantsTable({ rows }: { rows: Row[] }) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'under_review' | 'suspended' | 'closed'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.ownerName ?? '').toLowerCase().includes(q) ||
        (r.ownerEmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, query, statusFilter]);

  function toggleOne(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }
  function clearSel() { setSelected(new Set()); }

  async function runBulk(action: 'activate' | 'under_review' | 'suspend' | 'delete') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const label = action === 'delete' ? 'Eliminar' : action === 'suspend' ? 'Suspender' : action === 'under_review' ? 'Marcar bajo revisión' : 'Reactivar';
    if (!confirm(`${label} ${ids.length} sitio${ids.length === 1 ? '' : 's'}?${action === 'delete' ? ' Esto borra TODO su contenido y no se puede deshacer.' : ''}`)) return;
    setToast(null);
    start(async () => {
      const fd = new FormData();
      fd.set('action', action);
      fd.set('ids', ids.join(','));
      const res = await bulkUpdateTenantsAction(fd);
      clearSel();
      setToast({ ok: res.ok, msg: res.message ?? (res.ok ? 'Listo' : 'Error') });
      setTimeout(() => setToast(null), 6000);
    });
  }

  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar por nombre, slug, owner…"
          className="flex-1 min-w-[240px] rounded bg-white/5 border border-white/15 px-3 py-2 text-sm placeholder:text-white/35"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="under_review">Bajo revisión</option>
          <option value="suspended">Suspendidos</option>
          <option value="closed">Cerrados</option>
        </select>
        <span className="text-xs text-white/45 whitespace-nowrap">
          {filtered.length} de {rows.length}
        </span>
      </div>

      {/* Toast de resultado del bulk action */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm border flex items-start gap-2 ${
          toast.ok
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
            : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
        }`}>
          <span>{toast.ok ? '✓' : '✗'}</span>
          <div className="flex-1">{toast.msg}</div>
          <button onClick={() => setToast(null)} className="text-xs opacity-60 hover:opacity-100">×</button>
        </div>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-emerald-200 font-medium">
            {selected.size} sitio{selected.size === 1 ? '' : 's'} seleccionado{selected.size === 1 ? '' : 's'}
          </span>
          <div className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => runBulk('activate')} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-40">
              ✓ Reactivar
            </button>
            <button type="button" onClick={() => runBulk('under_review')} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 disabled:opacity-40">
              🔍 Bajo revisión
            </button>
            <button type="button" onClick={() => runBulk('suspend')} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-orange-500/40 bg-orange-500/10 text-orange-200 hover:bg-orange-500/20 disabled:opacity-40">
              ⏸ Suspender
            </button>
            <button type="button" onClick={() => runBulk('delete')} disabled={pending}
              className="text-xs px-2.5 py-1 rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 disabled:opacity-40">
              🗑 Eliminar
            </button>
            <button type="button" onClick={clearSel} disabled={pending}
              className="text-xs px-2 py-1 text-white/50 hover:text-white">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            {rows.length === 0 ? 'Ningún sitio todavía.' : 'Ningún sitio matchea los filtros.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="pl-4 pr-1 py-2.5 w-6">
                  <input type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.currentTarget.checked) for (const r of filtered) next.add(r.id);
                      else for (const r of filtered) next.delete(r.id);
                      setSelected(next);
                    }}
                    className="w-3.5 h-3.5 cursor-pointer align-middle" />
                </th>
                <th className="text-left px-3 py-2.5">Sitio</th>
                <th className="text-left px-3 py-2.5">Owner</th>
                <th className="text-left px-3 py-2.5">Comisión</th>
                <th className="text-right px-3 py-2.5">Saldo</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-left px-3 py-2.5">Alta</th>
                <th className="text-right px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const isSel = selected.has(t.id);
                return (
                  <tr key={t.id} className={`border-t border-white/5 ${isSel ? 'bg-emerald-500/[0.04]' : ''}`}>
                    <td className="pl-4 pr-1 py-2.5 align-middle">
                      <input type="checkbox" checked={isSel}
                        onChange={() => toggleOne(t.id)}
                        className="w-3.5 h-3.5 cursor-pointer" />
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      <div>{t.name}</div>
                      <div className="text-[10px] text-white/40 font-mono">{t.slug}</div>
                    </td>
                    <td className="px-3 py-2.5 text-white/70 text-xs">
                      {t.ownerName || t.ownerEmail ? (
                        <div>
                          <div className="text-white/90">{t.ownerName ?? '—'}</div>
                          <div className="text-white/40">{t.ownerEmail ?? '—'}</div>
                        </div>
                      ) : <span className="text-white/30">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-white/80">
                      {t.commission_rate_override !== null
                        ? `${(Number(t.commission_rate_override) * 100).toFixed(1)}%`
                        : <span className="text-white/40 text-xs">global</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {t.balance <= 0
                        ? <span className="text-white/30">$0</span>
                        : <span className={t.balance >= 200_000_00 ? 'text-red-300' : t.balance >= 50_000_00 ? 'text-amber-300' : 'text-white'}>
                            ${(t.balance / 100).toLocaleString('es-AR')}
                          </span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2.5 text-white/50">
                      {new Date(t.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex justify-end items-center gap-1.5 flex-wrap">
                        <SettleDebtButton tenantId={t.id} tenantSlug={t.slug} balanceCents={t.balance} />
                        <ReprocessPaymentButton tenantId={t.id} />
                        <form action={impersonateTenantAction}>
                          <input type="hidden" name="slug" value={t.slug} />
                          <button className="text-xs rounded border border-orange-500/30 bg-orange-500/10 text-amber-400 px-2 py-1 hover:bg-orange-500/20">
                            Abrir →
                          </button>
                        </form>
                        <DeleteTenantButton tenantId={t.id} slug={t.slug} name={t.name} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    active:       { cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30', label: 'activo' },
    under_review: { cls: 'bg-amber-500/10 text-amber-300 border-amber-500/30',       label: 'bajo revisión' },
    suspended:    { cls: 'bg-orange-500/10 text-orange-300 border-orange-500/30',    label: 'suspendido' },
    closed:       { cls: 'bg-red-500/10 text-red-300 border-red-500/30',             label: 'cerrado' }
  };
  const m = map[status] ?? { cls: 'bg-white/5 border-white/15', label: status };
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${m.cls}`}>{m.label}</span>;
}
