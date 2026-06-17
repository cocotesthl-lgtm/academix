import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createVipPackAction, deleteVipPackAction } from '@/lib/vip/actions';

export const dynamic = 'force-dynamic';

type PackRow = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  status: string;
  cover_url: string | null;
  media_items: Array<unknown> | null;
  created_at: string;
};

export default async function VipListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let packs: PackRow[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('courses') as any)
      .select('id, slug, title, price_cents, status, cover_url, media_items, created_at')
      .eq('tenant_id', tenant.id)
      .eq('product_type', 'vip_pack')
      .order('created_at', { ascending: false });
    if (error?.message?.includes('does not exist') || error?.message?.includes('column')) migrationMissing = true;
    packs = (data ?? []) as PackRow[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">🔒 Contenido VIP / Multimedia</h1>
        <p className="text-white/60 text-sm mt-1">
          Paquetes de fotos, videos o audios que se desbloquean al pagar. Tipo OnlyFans / Patreon.
          Cada pack es un producto con su propio precio. La galería completa solo se ve después de la compra.
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <form action={createVipPackAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="font-semibold">Nuevo pack VIP</h2>
          <input
            name="title"
            required
            placeholder="Título (ej. Pack fotos exclusivas mayo)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          />
          <input
            name="description"
            placeholder="Descripción corta visible en el catálogo"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              placeholder="Precio (en ARS)"
              required
              className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono"
            />
            <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
              + Crear pack
            </button>
          </div>
          <p className="text-[10px] text-white/40">
            💡 El pack se crea como borrador. Después agregás imágenes / videos por URL y lo publicás.
          </p>
        </form>
      )}

      {!migrationMissing && packs.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
          Todavía no creaste ningún pack.
        </div>
      )}

      {!migrationMissing && packs.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packs.map((p) => {
            const itemCount = Array.isArray(p.media_items) ? p.media_items.length : 0;
            return (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                <div className="aspect-video bg-black/40 relative">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl">🔒</div>
                  )}
                  <span className="absolute top-2 right-2 text-[10px] uppercase font-bold px-2 py-1 rounded bg-black/70 backdrop-blur"
                    style={{ color: p.status === 'published' ? '#10b981' : '#f59e0b' }}>
                    {p.status === 'published' ? '🟢 Publicado' : '🟡 Borrador'}
                  </span>
                </div>
                <div className="p-4">
                  <Link href={`/vip/${p.id}`} className="font-semibold hover:underline block">{p.title}</Link>
                  <div className="text-xs text-white/55 mt-1">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'} ·{' '}
                    {p.price_cents === 0 ? 'Gratis' : `$ ${(p.price_cents / 100).toLocaleString('es-AR')} ARS`}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Link
                      href={`/vip/${p.id}`}
                      className="text-xs px-3 py-1.5 rounded border border-white/15 hover:bg-white/5 flex-1 text-center"
                    >
                      Editar
                    </Link>
                    <form action={deleteVipPackAction}>
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        className="text-xs px-2.5 py-1.5 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                        type="submit"
                      >✕</button>
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
