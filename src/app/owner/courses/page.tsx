import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { EmptyState } from "@/components/owner/EmptyState";
import { PageHeader, HeaderPrimary } from "@/components/owner/PageHeader";
import { Sparkline } from "@/components/owner/Sparkline";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  created_at: string;
};

export default async function CoursesIndex() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("courses")
    .select("id, slug, title, status, price_cents, currency, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as CourseRow[];

  // Stats por publicación (clientes únicos + revenue total + trend 30d)
  type Stats = { clients: number; revenue: number; trend: number[] };
  const stats = new Map<string, Stats>();
  const courseIds = courses.map((c) => c.id);
  const now = Date.now();
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  if (courseIds.length > 0) {
    const [{ data: enrollAgg }, { data: salesAgg }, { data: salesWithDate }] = await Promise.all([
      svc.from('enrollments').select('course_id, user_id')
        .eq('tenant_id', tenant.id).in('course_id', courseIds),
      svc.from('sales').select('course_id, amount_gross_cents')
        .eq('tenant_id', tenant.id).eq('status', 'paid').in('course_id', courseIds),
      svc.from('sales').select('course_id, amount_gross_cents, occurred_at')
        .eq('tenant_id', tenant.id).eq('status', 'paid').in('course_id', courseIds).gte('occurred_at', since30)
    ]);
    const uniqueByCourse = new Map<string, Set<string>>();
    for (const e of ((enrollAgg ?? []) as Array<{ course_id: string; user_id: string }>)) {
      if (!uniqueByCourse.has(e.course_id)) uniqueByCourse.set(e.course_id, new Set());
      uniqueByCourse.get(e.course_id)!.add(e.user_id);
    }
    const revByCourse = new Map<string, number>();
    for (const s of ((salesAgg ?? []) as Array<{ course_id: string; amount_gross_cents: number }>)) {
      revByCourse.set(s.course_id, (revByCourse.get(s.course_id) ?? 0) + Number(s.amount_gross_cents));
    }
    // Trend: 30 buckets de un día cada uno, por publicación
    const trendByCourse = new Map<string, number[]>();
    for (const c of courses) trendByCourse.set(c.id, Array.from({ length: 30 }, () => 0));
    for (const s of ((salesWithDate ?? []) as Array<{ course_id: string; amount_gross_cents: number; occurred_at: string }>)) {
      const arr = trendByCourse.get(s.course_id);
      if (!arr) continue;
      const daysAgo = Math.floor((now - new Date(s.occurred_at).getTime()) / 86400_000);
      const idx = 29 - daysAgo;
      if (idx >= 0 && idx < 30) arr[idx] += Number(s.amount_gross_cents);
    }
    for (const c of courses) {
      stats.set(c.id, {
        clients: uniqueByCourse.get(c.id)?.size ?? 0,
        revenue: revByCourse.get(c.id) ?? 0,
        trend: trendByCourse.get(c.id) ?? Array.from({ length: 30 }, () => 0)
      });
    }
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Mis productos"
        description="Vendé lo que quieras: publicación online, evento con tickets, mentoría, producto físico o digital. Todo se gestiona acá."
        actions={<HeaderPrimary href="/courses/new">+ Crear nuevo</HeaderPrimary>}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon="🛍️"
          title="Todavía no creaste ningún producto"
          description="Un producto puede ser una publicación online, un evento con entradas, una mentoría 1-a-1, un producto físico o digital. Creá el primero y empezá a vender."
          primary={{ label: '+ Crear primer producto', href: '/courses/new' }}
          secondary={{ label: 'Editar mi sitio', href: '/site' }}
        />
      ) : (
      <div className="rounded-xl border border-white/10 overflow-hidden">
        {(
          <table className="w-full text-sm">
            <thead className="bg-[#0f0f0f] text-white/50 text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="text-left px-4 py-2.5">Título</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Precio</th>
                <th className="text-right px-4 py-2.5">Clientes</th>
                <th className="text-right px-4 py-2.5">Recaudado</th>
                <th className="text-right px-4 py-2.5">Últ. 30d</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const s = stats.get(c.id);
                return (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/courses/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <div className="text-xs text-white/40">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${
                      c.status === 'published'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : c.status === 'archived'
                          ? 'border-white/15 text-white/40'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {c.price_cents === 0 ? 'Gratis' : `${(c.price_cents / 100).toLocaleString('es-AR')} ${c.currency}`}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {s?.clients ?? 0}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {s && s.revenue > 0 ? (
                      <span className="text-emerald-300">
                        ${(s.revenue / 100).toLocaleString('es-AR')}
                      </span>
                    ) : (
                      <span className="text-white/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s && s.trend.some((v) => v > 0) ? (
                      <Sparkline values={s.trend} color="#10b981" width={90} height={24} className="inline-block" />
                    ) : (
                      <span className="text-white/25 text-xs">sin ventas</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/courses/${c.id}`} className="text-xs text-white/60 hover:text-white">
                      Editar →
                    </Link>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
