'use client';

import { useState, useTransition } from 'react';
import { renameTenantAction, deleteTenantAction } from '@/lib/tenant/actions';

/**
 * Fila de un sitio en /owner/mis-sitios con acciones rename + delete.
 * Client component porque los forms viven en un modal con state local
 * (safeguard: hay que tipear el slug exacto para confirmar delete).
 */
export function ManageSiteRow({
  tenantId, slug, name, logoUrl, brandColor, status, publicUrl, isCurrent
}: {
  tenantId: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  status: string;
  publicUrl: string;
  isCurrent: boolean;
}) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [confirmSlug, setConfirmSlug] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function doRename() {
    setErr(null);
    if (!newName.trim() || newName === name) { setRenameOpen(false); return; }
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId);
      fd.set('name', newName.trim());
      const res = await renameTenantAction(fd);
      if (!res.ok) { setErr(res.error ?? 'Error'); return; }
      setRenameOpen(false);
      // Refresh para ver el nuevo nombre
      location.reload();
    });
  }

  function doDelete() {
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId);
      fd.set('confirm_slug', confirmSlug.trim().toLowerCase());
      const res = await deleteTenantAction(fd);
      if (!res.ok) { setErr(res.error ?? 'Error'); return; }
      // Redirect al lugar sugerido por la action
      location.href = res.redirectTo ?? '/owner/mis-sitios';
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="w-11 h-11 rounded-md object-cover border border-white/10 shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-md grid place-items-center font-bold text-white border border-white/10 shrink-0"
            style={{ background: brandColor }}>
            {name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold truncate">{name}</div>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                Actual
              </span>
            )}
            {status !== 'active' && (
              <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300">
                {status}
              </span>
            )}
          </div>
          <a href={publicUrl} target="_blank" rel="noopener"
            className="text-[11px] text-white/45 font-mono hover:text-white/70 truncate block">
            {publicUrl}
          </a>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button" onClick={() => { setRenameOpen(true); setDeleteOpen(false); }}
            className="text-xs px-3 py-1.5 rounded border border-white/15 hover:bg-white/5">
            ✎ Renombrar
          </button>
          <button type="button" onClick={() => { setDeleteOpen(true); setRenameOpen(false); setConfirmSlug(''); }}
            className="text-xs px-3 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
            🗑 Eliminar
          </button>
        </div>
      </div>

      {/* Rename inline panel */}
      {renameOpen && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
          <label className="text-[11px] text-white/50 uppercase tracking-wider">Nuevo nombre</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100}
            autoFocus
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={doRename} disabled={pending}
              className="text-xs px-3 py-1.5 rounded bg-white text-black font-semibold disabled:opacity-50">
              {pending ? '…' : 'Guardar'}
            </button>
            <button type="button" onClick={() => { setRenameOpen(false); setErr(null); setNewName(name); }}
              className="text-xs px-3 py-1.5 rounded border border-white/15">
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-white/40">
            El <code className="text-white/60">slug</code> (URL) NO cambia — modificarlo rompería links compartidos y SEO.
          </p>
        </div>
      )}

      {/* Delete inline panel — safeguard: tipear el slug exacto */}
      {deleteOpen && (
        <div className="mt-3 pt-3 border-t border-rose-500/30 bg-rose-500/[0.03] -mx-4 -mb-4 px-4 pb-4 space-y-2 rounded-b-xl">
          <div className="text-xs text-rose-200 font-medium">⚠️ Esto elimina TODO permanentemente</div>
          <p className="text-[11px] text-white/60">
            Se borran: cursos, productos, ventas, órdenes, suscripciones, links de pago, artículos, formularios, CRM, calendario, reservas, y todo lo asociado al sitio. <strong className="text-rose-200">No se puede deshacer.</strong>
          </p>
          <label className="text-[11px] text-white/70 block mt-2">
            Tipeá <code className="bg-black/40 text-rose-200 px-1.5 py-0.5 rounded font-mono text-[11px]">{slug}</code> para confirmar:
          </label>
          <input value={confirmSlug} onChange={(e) => setConfirmSlug(e.target.value)} autoFocus
            placeholder={slug}
            className="w-full rounded bg-white/5 border border-rose-500/30 px-3 py-2 text-sm font-mono" />
          {err && <p className="text-xs text-rose-300">{err}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={doDelete}
              disabled={pending || confirmSlug.trim().toLowerCase() !== slug}
              className="text-xs px-3 py-1.5 rounded bg-rose-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
              {pending ? '…' : 'Eliminar sitio para siempre'}
            </button>
            <button type="button" onClick={() => { setDeleteOpen(false); setErr(null); setConfirmSlug(''); }}
              className="text-xs px-3 py-1.5 rounded border border-white/15">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
