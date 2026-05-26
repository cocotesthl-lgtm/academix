import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type LinkRow = {
  id: string;
  code: string;
  created_at: string;
  course_id: string;
  affiliate_user_id: string;
  courses: { title: string } | null;
  profiles: { email: string | null; display_name: string | null } | null;
};

export default async function OwnerAffiliates() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data } = await svc
    .from("affiliate_links")
    .select("id, code, created_at, course_id, affiliate_user_id, courses(title), profiles:affiliate_user_id(email, display_name)")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as LinkRow[];

  // Click counts per link
  const linkIds = rows.map((r) => r.id);
  let clicksByLink = new Map<string, number>();
  const commByAffiliate = new Map<string, number>();
  if (linkIds.length > 0) {
    const [{ data: clicks }, { data: comms }] = await Promise.all([
      svc.from("affiliate_clicks").select("affiliate_link_id").in("affiliate_link_id", linkIds),
      svc.from("affiliate_commissions")
        .select("user_id, amount_cents")
        .eq("tenant_id", tenant.id)
    ]);
    const clickArr = (clicks ?? []) as Array<{ affiliate_link_id: string }>;
    clicksByLink = clickArr.reduce((acc, c) => {
      acc.set(c.affiliate_link_id, (acc.get(c.affiliate_link_id) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const commArr = (comms ?? []) as Array<{ user_id: string; amount_cents: number }>;
    for (const c of commArr) {
      commByAffiliate.set(c.user_id, (commByAffiliate.get(c.user_id) ?? 0) + Number(c.amount_cents));
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Afiliados</h1>
        <p className="text-white/60 text-sm mt-1">
          Personas que están promocionando tus cursos.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            Todavía nadie generó links de afiliado para tu academia.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Afiliado</th>
                <th className="text-left px-4 py-2.5">Curso</th>
                <th className="text-left px-4 py-2.5">Código</th>
                <th className="text-right px-4 py-2.5">Clicks</th>
                <th className="text-right px-4 py-2.5">Comisiones</th>
                <th className="text-left px-4 py-2.5">Alta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    {r.profiles?.display_name ?? r.profiles?.email ?? r.affiliate_user_id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-white/80">{r.courses?.title ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3 text-right">{clicksByLink.get(r.id) ?? 0}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {((commByAffiliate.get(r.affiliate_user_id) ?? 0) / 100).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(r.created_at).toLocaleDateString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-white/40">
        Clicks y comisiones se acumulan automáticamente cuando se completan ventas con el link de cada afiliado.
      </p>
    </div>
  );
}
