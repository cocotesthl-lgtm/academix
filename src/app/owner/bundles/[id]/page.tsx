import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  updateBundleAction,
  addBundleItemAction,
  removeBundleItemAction,
  addBundleItemPhysicalAction,
  removeBundleItemPhysicalAction
} from '@/lib/bundles/actions';

export const dynamic = 'force-dynamic';

type Bundle = {
  id: string; slug: string; title: string; description: string | null;
  status: string; price_cents: number; list_price_cents: number | null;
  cover_url: string | null;
};

type ItemRow = {
  course_id: string | null;
  physical_product_id: string | null;
  position: number;
  courses: { id: string; title: string; product_type: string | null; price_cents: number } | null;
  physical_products: { id: string; title: string; price_cents: number; cover_url: string | null } | null;
};

type CourseOpt = { id: string; title: string; product_type: string | null; price_cents: number };
type PhysicalOpt = { id: string; title: string; price_cents: number; cover_url: string | null };

export default async function BundleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bundleRaw } = await (svc.from('bundles') as any)
    .select('id, slug, title, description, status, price_cents, list_price_cents, cover_url')
    .eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const bundle = bundleRaw as Bundle | null;
  if (!bundle) notFound();

  // Defensivo: si migration 0056 no corrió, la col physical_product_id no
  // existe. Intento con ambas cols; en caso de error, reintento sin.
  let items: ItemRow[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('bundle_items') as any)
      .select('course_id, physical_product_id, position, courses ( id, title, product_type, price_cents ), physical_products ( id, title, price_cents, cover_url )')
      .eq('bundle_id', id).order('position');
    items = (data ?? []) as unknown as ItemRow[];
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('bundle_items') as any)
      .select('course_id, position, courses ( id, title, product_type, price_cents )')
      .eq('bundle_id', id).order('position');
    items = ((data ?? []) as Array<{ course_id: string; position: number; courses: ItemRow['courses'] }>)
      .map((r) => ({ ...r, physical_product_id: null, physical_products: null }));
  }
  const includedCourseIds = new Set(items.filter((i) => i.course_id).map((i) => i.course_id));
  const includedPhysicalIds = new Set(items.filter((i) => i.physical_product_id).map((i) => i.physical_product_id));

  // Todas las publicaciones/packs del tenant para agregar
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: optsRaw } = await (svc.from('courses') as any)
    .select('id, title, product_type, price_cents')
    .eq('tenant_id', tenant.id).neq('status', 'archived').order('title');
  const allCourseOptions = (optsRaw ?? []) as CourseOpt[];
  const availableCourses = allCourseOptions.filter((o) => !includedCourseIds.has(o.id));

  // Productos físicos del tenant (defensivo si migration 0051 pendiente)
  let allPhysicalOptions: PhysicalOpt[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: physOpts } = await (svc.from('physical_products') as any)
      .select('id, title, price_cents, cover_url')
      .eq('tenant_id', tenant.id).eq('status', 'published').order('title');
    allPhysicalOptions = (physOpts ?? []) as PhysicalOpt[];
  } catch { /* migration pendiente */ }
  const availablePhysical = allPhysicalOptions.filter((o) => !includedPhysicalIds.has(o.id));

  const totalListPrice = items.reduce((s, i) =>
    s + (i.courses?.price_cents ?? i.physical_products?.price_cents ?? 0), 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/bundles" className="text-xs text-white/50 hover:text-white">← Bundles</Link>
        <h1 className="text-2xl font-bold mt-1">{bundle.title}</h1>
      </div>

      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5" open>
        <summary className="cursor-pointer font-semibold select-none">⚙ Configuración</summary>
        <form action={updateBundleAction} className="space-y-3 mt-4">
          <input type="hidden" name="id" value={bundle.id} />
          <div>
            <label className="text-xs text-white/60">Título</label>
            <input name="title" defaultValue={bundle.title} required
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Descripción</label>
            <input name="description" defaultValue={bundle.description ?? ''}
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Precio del bundle (ARS)</label>
              <input name="price" type="number" min={0} step="0.01" required
                defaultValue={(bundle.price_cents / 100).toString()}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-white/60">Precio &quot;lista&quot; (suelto)</label>
              <input name="list_price" type="number" min={0} step="0.01"
                defaultValue={((bundle.list_price_cents ?? 0) / 100).toString()}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">URL de portada</label>
              <input name="cover_url" type="url" defaultValue={bundle.cover_url ?? ''}
                placeholder="https://…"
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="text-xs text-white/60">Estado</label>
              <select name="status" defaultValue={bundle.status}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="draft">🟡 Borrador</option>
                <option value="published">🟢 Publicado</option>
              </select>
            </div>
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
            Guardar
          </button>
        </form>
      </details>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">📦 Items del bundle ({items.length})</h2>
          {totalListPrice > 0 && (
            <p className="text-xs text-white/55">
              Valor suelto: <strong>$ {(totalListPrice / 100).toLocaleString('es-AR')}</strong>
            </p>
          )}
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-white/40">Aún no agregaste items.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const isPhys = !!it.physical_product_id;
              const title = it.courses?.title ?? it.physical_products?.title ?? '—';
              const price = it.courses?.price_cents ?? it.physical_products?.price_cents ?? 0;
              const label = isPhys
                ? '📦 Producto físico'
                : (it.courses?.product_type === 'vip_pack' ? '🔒 VIP Pack' : '📚 Publicación');
              const key = it.course_id ?? it.physical_product_id ?? '';
              return (
                <li key={key} className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{title}</div>
                    <div className="text-[10px] text-white/45">
                      {label} · $ {(price / 100).toLocaleString('es-AR')}
                    </div>
                  </div>
                  <form action={isPhys ? removeBundleItemPhysicalAction : removeBundleItemAction}>
                    <input type="hidden" name="bundle_id" value={bundle.id} />
                    {isPhys
                      ? <input type="hidden" name="product_id" value={it.physical_product_id ?? ''} />
                      : <input type="hidden" name="course_id" value={it.course_id ?? ''} />}
                    <button type="submit"
                      className="text-xs px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">✕</button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        <div className="pt-3 border-t border-white/10 space-y-3">
          {availableCourses.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold select-none">📚 + Agregar curso / publicación</summary>
              <form action={addBundleItemAction} className="flex gap-2 mt-3">
                <input type="hidden" name="bundle_id" value={bundle.id} />
                <select name="course_id" required
                  className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                  <option value="">— elegí una publicación o pack —</option>
                  {availableCourses.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.product_type === 'vip_pack' ? '🔒 ' : '📚 '}{o.title} · $ {(o.price_cents / 100).toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
                <button className="rounded bg-white text-black text-sm font-semibold px-3">Agregar</button>
              </form>
            </details>
          )}

          {availablePhysical.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm font-semibold select-none">📦 + Agregar producto físico</summary>
              <form action={addBundleItemPhysicalAction} className="flex gap-2 mt-3">
                <input type="hidden" name="bundle_id" value={bundle.id} />
                <select name="product_id" required
                  className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                  <option value="">— elegí un producto físico —</option>
                  {availablePhysical.map((o) => (
                    <option key={o.id} value={o.id}>
                      📦 {o.title} · $ {(o.price_cents / 100).toLocaleString('es-AR')}
                    </option>
                  ))}
                </select>
                <button className="rounded bg-white text-black text-sm font-semibold px-3">Agregar</button>
              </form>
            </details>
          )}

          {availableCourses.length === 0 && availablePhysical.length === 0 && (
            <p className="text-xs text-white/40">
              No hay más items disponibles para agregar. Creá cursos en /courses o productos físicos en /products.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
