import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  createCouponAction,
  setCouponStatusAction,
  deleteCouponAction
} from "@/lib/coupons/actions";
import { PageHeader } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

type Coupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  amount: number;
  course_id: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  status: string;
  source: string;
  created_at: string;
};

type CourseOpt = { id: string; title: string };

export default async function CouponsPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const [{ data: couponsRaw }, { data: coursesRaw }] = await Promise.all([
    svc.from('coupons')
      .select('id, code, type, amount, course_id, max_redemptions, redemption_count, expires_at, status, source, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false }),
    svc.from('courses').select('id, title').eq('tenant_id', tenant.id).order('title')
  ]);

  const coupons = (couponsRaw ?? []) as Coupon[];
  const courses = (coursesRaw ?? []) as CourseOpt[];
  const titleById = new Map(courses.map((c) => [c.id, c.title]));

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="Cupones de descuento"
        description="Códigos promocionales con % o monto fijo, límite de usos y expiración. Aplicables a un publicación o a todos."
      />

      {/* Create form */}
      <form
        action={async (fd) => {
          'use server';
          await createCouponAction(fd);
        }}
        className="rounded-xl border border-white/15 bg-white/[0.02] p-5 space-y-4"
      >
        <h2 className="font-semibold">+ Nuevo cupón</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-white/60 mb-1">Código (vacío = generar automático)</label>
            <input name="code" placeholder="VERANO20" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Tipo de descuento</label>
            <select name="type" defaultValue="percent" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40">
              <option value="percent">Porcentaje (%)</option>
              <option value="fixed">Monto fijo ($)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Valor</label>
            <input name="amount" type="number" min="0" step="0.01" required placeholder="20" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Aplica a publicación</label>
            <select name="course_id" defaultValue="" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40">
              <option value="">Todos los publicaciones</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Máx. usos (vacío = ilimitado)</label>
            <input name="max_redemptions" type="number" min="1" placeholder="100" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs text-white/60 mb-1">Expira (opcional)</label>
            <input name="expires_at" type="datetime-local" className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
        </div>
        <button className="rounded bg-white text-black px-4 py-2 text-sm font-medium hover:bg-white/90">
          Crear cupón
        </button>
      </form>

      {/* List */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {coupons.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">Sin cupones todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Código</th>
                <th className="text-left px-4 py-2.5">Descuento</th>
                <th className="text-left px-4 py-2.5">Aplica a</th>
                <th className="text-left px-4 py-2.5">Usos</th>
                <th className="text-left px-4 py-2.5">Expira</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-3 font-mono">
                    {c.code}
                    {c.source === 'wheel' && <span className="ml-2 text-xs text-purple-300">🎰</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.type === 'percent'
                      ? `${c.amount}%`
                      : `$${(Number(c.amount) / 100).toLocaleString('es-AR')}`}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {c.course_id ? (titleById.get(c.course_id) ?? '—') : <span className="text-white/40">Todos</span>}
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {c.redemption_count}{c.max_redemptions !== null ? ` / ${c.max_redemptions}` : ' / ∞'}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded border ${
                      c.status === 'active' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' :
                      c.status === 'paused' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' :
                      'border-white/15 text-white/40'
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-1 justify-end">
                      {c.status === 'active' ? (
                        <form action={setCouponStatusAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="status" value="paused" />
                          <button className="text-xs rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 px-2 py-1 hover:bg-amber-500/20">Pausar</button>
                        </form>
                      ) : (
                        <form action={setCouponStatusAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="status" value="active" />
                          <button className="text-xs rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 px-2 py-1 hover:bg-emerald-500/20">Activar</button>
                        </form>
                      )}
                      <form action={deleteCouponAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="text-xs rounded border border-red-500/30 bg-red-500/10 text-red-300 px-2 py-1 hover:bg-red-500/20">Eliminar</button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
