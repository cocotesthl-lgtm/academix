'use client';

import { useState, useMemo, useTransition } from 'react';
import { UserRowActions } from './UserRowActions';
import { bulkUpdateUsersAction } from '@/lib/founder/moderation';

type Row = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_super_admin: boolean;
  moderation_status: 'active' | 'under_review' | 'suspended';
  created_at: string;
  ownerCount: number;
  enrollCount: number;
  ownedTenantSlug: string | null;
};

/**
 * Tabla client con buscador + multi-select + barra de acciones bulk.
 * La página server-side fetchea todo y le pasa las rows crudas; acá
 * hacemos filter en memoria (funciona bien hasta ~10k rows sin lag).
 */
export function FounderUsersTable({
  rows, myId
}: {
  rows: Row[];
  myId: string | null;
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'under_review' | 'suspended'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && r.moderation_status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.display_name ?? '').toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
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
    // Excluir self
    const ids = Array.from(selected).filter((id) => id !== myId);
    if (ids.length === 0) return;
    const label = action === 'delete' ? 'Eliminar' : action === 'suspend' ? 'Suspender' : action === 'under_review' ? 'Marcar bajo revisión' : 'Reactivar';
    if (!confirm(`${label} ${ids.length} usuario${ids.length === 1 ? '' : 's'}?${action === 'delete' ? ' Esta acción no se puede deshacer.' : ''}`)) return;
    start(async () => {
      const fd = new FormData();
      fd.set('action', action);
      fd.set('ids', ids.join(','));
      await bulkUpdateUsersAction(fd);
      clearSel();
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
          placeholder="🔍 Buscar por nombre, email o ID…"
          className="flex-1 min-w-[240px] rounded bg-white/5 border border-white/15 px-3 py-2 text-sm placeholder:text-white/35"
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="under_review">Bajo revisión</option>
          <option value="suspended">Suspendidos</option>
        </select>
        <span className="text-xs text-white/45 whitespace-nowrap">
          {filtered.length} de {rows.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/[0.06] px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-emerald-200 font-medium">
            {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
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
            {rows.length === 0 ? 'Sin usuarios todavía.' : 'Ningún usuario matchea los filtros.'}
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
                <th className="text-left px-3 py-2.5">Nombre</th>
                <th className="text-left px-3 py-2.5">Email</th>
                <th className="text-left px-3 py-2.5">Estado</th>
                <th className="text-left px-3 py-2.5">Rol</th>
                <th className="text-left px-3 py-2.5">Sitios</th>
                <th className="text-left px-3 py-2.5">Inscripciones</th>
                <th className="text-left px-3 py-2.5">Alta</th>
                <th className="text-right px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isSelf = p.id === myId;
                const isSel = selected.has(p.id);
                return (
                  <tr key={p.id} className={`border-t border-white/5 ${isSel ? 'bg-emerald-500/[0.04]' : ''}`}>
                    <td className="pl-4 pr-1 py-2.5 align-middle">
                      <input type="checkbox" checked={isSel}
                        disabled={isSelf}
                        title={isSelf ? 'No podés operar sobre tu propio usuario' : ''}
                        onChange={() => toggleOne(p.id)}
                        className="w-3.5 h-3.5 cursor-pointer disabled:opacity-30" />
                    </td>
                    <td className="px-3 py-2.5 font-medium">{p.display_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-white/60">{p.email ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge s={p.moderation_status} />
                    </td>
                    <td className="px-3 py-2.5">
                      {p.is_super_admin
                        ? <span className="text-xs px-2 py-0.5 rounded border border-orange-500/30 bg-orange-500/10 text-amber-400">super_admin</span>
                        : p.ownerCount > 0
                          ? <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">owner</span>
                          : p.enrollCount > 0
                            ? <span className="text-xs px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300">alumno</span>
                            : <span className="text-xs text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-white/70">{p.ownerCount}</td>
                    <td className="px-3 py-2.5 text-white/70">{p.enrollCount}</td>
                    <td className="px-3 py-2.5 text-white/50">{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-3 py-2.5 text-right">
                      <UserRowActions
                        profileId={p.id}
                        email={p.email}
                        displayName={p.display_name}
                        isSuperAdmin={p.is_super_admin}
                        isSelf={isSelf}
                        ownedTenantSlug={p.ownedTenantSlug}
                      />
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

function StatusBadge({ s }: { s: 'active' | 'under_review' | 'suspended' }) {
  const map = {
    active:       { cls: 'border-emerald-500/25 text-emerald-300', label: 'activo' },
    under_review: { cls: 'border-amber-500/40 bg-amber-500/10 text-amber-300', label: 'bajo revisión' },
    suspended:    { cls: 'border-rose-500/40 bg-rose-500/10 text-rose-300', label: 'suspendido' }
  };
  const m = map[s];
  return <span className={`text-[10px] px-1.5 py-0.5 rounded border ${m.cls}`}>{m.label}</span>;
}
