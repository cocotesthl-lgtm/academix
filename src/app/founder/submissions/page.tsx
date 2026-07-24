import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type TenantOpt = { id: string; name: string; slug: string };
type FormLite = { id: string; name: string; tenant_id: string };

type Submission = {
  id: string;
  form_id: string;
  tenant_id: string;
  data: Record<string, unknown>;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  source_url: string | null;
  lead_id: string | null;
  submitted_at: string;
};

/**
 * Vista founder cross-tenant de todas las form submissions.
 * Filtros: tenant + form + búsqueda por nombre/email/phone.
 * Cada row expande el JSON completo del payload en un <details>.
 */
export default async function FounderSubmissionsPage({
  searchParams
}: {
  searchParams: Promise<{ tenant?: string; form?: string; q?: string; limit?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const tenantFilter = sp.tenant?.trim() || '';
  const formFilter = sp.form?.trim() || '';
  const q = sp.q?.trim() ?? '';
  const limit = Math.min(500, Math.max(20, parseInt(sp.limit ?? '100', 10) || 100));

  const svc = getServiceClient();

  const { data: tenantsRaw } = await svc
    .from('tenants').select('id, name, slug').order('name');
  const tenants = (tenantsRaw ?? []) as TenantOpt[];
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  // Traer formularios (para el 2do dropdown de filtro)
  let forms: FormLite[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fq = (svc.from('forms') as any).select('id, name, tenant_id').order('name');
    if (tenantFilter) fq = fq.eq('tenant_id', tenantFilter);
    const { data } = await fq;
    forms = (data ?? []) as FormLite[];
  } catch { /* migration pendiente */ }
  const formById = new Map(forms.map((f) => [f.id, f]));

  let submissions: Submission[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('form_submissions') as any)
      .select('id, form_id, tenant_id, data, submitter_name, submitter_email, submitter_phone, source_url, lead_id, submitted_at')
      .order('submitted_at', { ascending: false })
      .limit(limit);
    if (tenantFilter) query = query.eq('tenant_id', tenantFilter);
    if (formFilter) query = query.eq('form_id', formFilter);
    if (q) {
      const safe = q.replace(/[%_]/g, '\\$&');
      query = query.or(`submitter_name.ilike.%${safe}%,submitter_email.ilike.%${safe}%,submitter_phone.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    submissions = (data ?? []) as Submission[];
  } catch { migrationMissing = true; }

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Form submissions (todos los sitios)</h1>
        <p className="text-white/60 text-sm mt-1">
          Payloads crudos de todos los formularios enviados en cualquier sitio de la plataforma.
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          ⚠️ Migración 0030 (forms + CRM) pendiente en la DB.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Submissions" value={String(submissions.length)} sub={submissions.length === limit ? `(máx. ${limit})` : ''} />
        <Stat label="Con lead vinculado" value={String(submissions.filter((s) => s.lead_id).length)} />
        <Stat label="Formularios distintos" value={String(new Set(submissions.map((s) => s.form_id)).size)} />
        <Stat label="Sitios distintos" value={String(new Set(submissions.map((s) => s.tenant_id)).size)} />
      </div>

      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Sitio</label>
          <select name="tenant" defaultValue={tenantFilter}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[220px]">
            <option value="">Todos</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Formulario</label>
          <select name="form" defaultValue={formFilter}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[200px]">
            <option value="">Todos</option>
            {forms.map((f) => {
              const t = tenantById.get(f.tenant_id);
              return (
                <option key={f.id} value={f.id}>
                  {f.name}{t ? ` — ${t.slug}` : ''}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Buscar</label>
          <input name="q" defaultValue={q} placeholder="Nombre, email, teléfono"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Máx</label>
          <select name="limit" defaultValue={String(limit)}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>
        <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2">
          Filtrar
        </button>
        {(tenantFilter || formFilter || q) && (
          <Link href="/founder/submissions" className="text-xs text-white/50 hover:text-white px-3 py-2">
            Limpiar
          </Link>
        )}
      </form>

      {submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
          {tenantFilter || formFilter || q ? 'Ninguna submission matchea los filtros.' : 'No hay submissions todavía.'}
        </div>
      ) : (
        <div className="space-y-2">
          {submissions.map((s) => {
            const t = tenantById.get(s.tenant_id);
            const f = formById.get(s.form_id);
            const fields = Object.entries(s.data ?? {});
            return (
              <details key={s.id} className="rounded-lg border border-white/10 bg-white/[0.02]">
                <summary className="cursor-pointer px-4 py-3 flex items-center gap-3 flex-wrap text-sm hover:bg-white/[0.03] transition">
                  <span className="text-white/45 text-xs whitespace-nowrap">
                    {new Date(s.submitted_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium">{s.submitter_name ?? '—'}</span>
                  {s.submitter_email && <span className="text-white/60 text-xs">{s.submitter_email}</span>}
                  {s.submitter_phone && <span className="text-white/60 text-xs">{s.submitter_phone}</span>}
                  <span className="ml-auto flex items-center gap-2 text-xs text-white/45">
                    <span>📝 {f?.name ?? s.form_id.slice(0, 8)}</span>
                    <span>·</span>
                    {t ? (
                      <Link href={`/founder/tenants/${t.slug}`} className="hover:underline">
                        {t.slug}
                      </Link>
                    ) : '—'}
                    {s.lead_id && (
                      <span className="text-emerald-300 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30">
                        ↗ lead
                      </span>
                    )}
                  </span>
                </summary>
                <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-1">
                  {fields.length === 0 ? (
                    <p className="text-xs text-white/40 italic">Sin campos custom.</p>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody>
                        {fields.map(([k, v]) => (
                          <tr key={k} className="border-b border-white/5 last:border-b-0">
                            <td className="py-1.5 pr-4 text-white/50 uppercase tracking-wider text-[10px] align-top w-40">{k}</td>
                            <td className="py-1.5 text-white/80 break-words">
                              {typeof v === 'object' ? (
                                <code className="font-mono text-[11px]">{JSON.stringify(v)}</code>
                              ) : String(v ?? '—')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {s.source_url && (
                    <p className="text-[10px] text-white/40 mt-2">
                      Origen: <a href={s.source_url} target="_blank" rel="noopener" className="underline hover:text-white/60">
                        {s.source_url}
                      </a>
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/45">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}
