import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { togglePromotionAction, deletePromotionAction } from '@/lib/promotions/actions';
import {
  isPromotionActive, promotionSummary, PROMOTION_TYPE_EMOJI, PROMOTION_TYPE_LABEL,
  type Promotion
} from '@/lib/promotions/types';
import { PageHeader, HeaderPrimary } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let migrationMissing = false;
  let promos: Promotion[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('promotions') as any)
      .select('*').eq('tenant_id', tenant.id).order('priority', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    promos = (data ?? []) as Promotion[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Promociones y cupones"
        description="Todos los descuentos en un solo lugar: promociones automáticas del carrito (3x2, envío gratis, % por cantidad) y cupones con código."
        actions={<HeaderPrimary href="/promotions/new">+ Nueva promoción</HeaderPrimary>}
      />

      {/* Tabs — Promociones automáticas vs Cupones con código */}
      <div className="flex items-center gap-2 border-b border-white/10">
        <div className="px-4 py-2 border-b-2 border-white text-sm font-semibold">
          🏷️ Promociones automáticas
        </div>
        <Link href="/coupons"
          className="px-4 py-2 text-sm text-white/55 hover:text-white transition">
          🎟️ Cupones con código →
        </Link>
      </div>

      {migrationMissing && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm px-4 py-3">
          La migration <code>0057_promotions.sql</code> todavía no corrió en la DB. Aplicala para empezar a usar promociones.
        </div>
      )}

      {!migrationMissing && promos.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
          <div className="text-4xl mb-2">🏷️</div>
          <div className="font-semibold text-white">Todavía no tenés promociones</div>
          <p className="text-white/55 text-sm mt-1">
            Sumá una regla automática (3x2, % off por cantidad, envío gratis) para incentivar el carrito.
          </p>
          <div className="mt-4">
            <Link href="/promotions/new"
              className="inline-block bg-white text-black rounded-md px-4 py-2 text-sm font-semibold hover:bg-white/90">
              + Crear la primera
            </Link>
          </div>
        </div>
      )}

      {promos.length > 0 && (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 bg-white/[0.02]">
          {promos.map((p) => {
            const active = isPromotionActive(p);
            return (
              <div key={p.id} className="flex items-start gap-4 p-4">
                <div className="text-2xl">{PROMOTION_TYPE_EMOJI[p.type]}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/promotions/${p.id}`}
                      className="font-semibold text-white hover:underline">
                      {p.title}
                    </Link>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-white/50'
                    }`}>
                      {active ? 'Activa' : (p.enabled ? 'Fuera de vigencia' : 'Apagada')}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-white/40">
                      {PROMOTION_TYPE_LABEL[p.type].split('·')[0].trim()}
                    </span>
                  </div>
                  <div className="text-sm text-white/70 mt-1">
                    {promotionSummary(p)}
                  </div>
                  {p.description && (
                    <p className="text-xs text-white/45 mt-1 line-clamp-1">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={togglePromotionAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="enabled" value={p.enabled ? 'false' : 'true'} />
                    <button type="submit"
                      className={`text-xs font-semibold px-3 py-1.5 rounded transition ${
                        p.enabled
                          ? 'border border-white/15 text-white/75 hover:bg-white/5'
                          : 'bg-white text-black hover:bg-white/90'
                      }`}>
                      {p.enabled ? 'Apagar' : 'Prender'}
                    </button>
                  </form>
                  <form action={deletePromotionAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit"
                      className="text-xs text-red-300/70 hover:text-red-300 px-2 py-1.5">
                      Eliminar
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
