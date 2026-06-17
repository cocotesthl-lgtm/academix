import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createBundleAction, deleteBundleAction } from '@/lib/bundles/actions';

export const dynamic = 'force-dynamic';

type Bundle = {
  id: string; slug: string; title: string; status: string;
  price_cents: number; list_price_cents: number | null;
  cover_url: string | null;
};

export default async function BundlesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let bundles: Bundle[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('bundles') as any)
      .select('id, slug, title, status, price_cents, list_price_cents, cover_url')
      .eq('tenant_id', tenant.id).order('created_at', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    bundles = (data ?? []) as Bundle[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">🎁 Bundles</h1>
        <p className="text-white/60 text-sm mt-1">
          Vendé varios cursos o packs VIP juntos a un precio menor.
          Genial para upselling: "lleva los 3 packs por el precio de 2".
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <form action={createBundleAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="font-semibold">Nuevo bundle</h2>
          <input name="title" required placeholder="Título (ej. Pack completo 2026)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input name="description" placeholder="Descripción corta (opcional)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Precio del bundle (ARS)</label>
              <input name="price" type="number" min={0} step="0.01" required
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-white/60">Precio "lista" (suelto)</label>
              <input name="list_price" type="number" min={0} step="0.01"
                placeholder="Para mostrar tachado"
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
            + Crear bundle
          </button>
        </form>
      )}

      {!migrationMissing && bundles.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
          Sin bundles. Creá uno arriba.
        </div>
      )}

      {!migrationMissing && bundles.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bundles.map((b) => {
            const discount = (b.list_price_cents ?? 0) > b.price_cents
              ? Math.round((1 - b.price_cents / (b.list_price_cents ?? 1)) * 100)
              : 0;
            return (
              <div key={b.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 relative">
                  {b.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {discount > 0 && (
                    <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold uppercase px-2 py-1 rounded">
                      -{discount}%
                    </span>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] uppercase font-bold px-2 py-1 rounded bg-black/70"
                    style={{ color: b.status === 'published' ? '#10b981' : '#f59e0b' }}>
                    {b.status === 'published' ? '🟢 Publicado' : '🟡 Borrador'}
                  </span>
                </div>
                <div className="p-4">
                  <Link href={`/bundles/${b.id}`} className="font-semibold hover:underline block">
                    {b.title}
                  </Link>
                  <div className="text-xs text-white/55 mt-1">
                    <span className="font-bold text-white">$ {(b.price_cents / 100).toLocaleString('es-AR')}</span>
                    {(b.list_price_cents ?? 0) > b.price_cents && (
                      <span className="line-through text-white/40 ml-2">
                        $ {((b.list_price_cents ?? 0) / 100).toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link href={`/bundles/${b.id}`}
                      className="text-xs px-3 py-1.5 rounded border border-white/15 hover:bg-white/5 flex-1 text-center">
                      Editar items
                    </Link>
                    <form action={deleteBundleAction}>
                      <input type="hidden" name="id" value={b.id} />
                      <button type="submit"
                        className="text-xs px-2.5 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
