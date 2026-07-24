import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type TenantOpt = { id: string; name: string; slug: string };

type Lead = {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  stage_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  value_cents: number | null;
  currency: string | null;
  source: string | null;
  notes: string | null;
  assigned_to_user_id: string | null;
  created_at: string;
};

type StageLite = { id: string; name: string; color: string | null; is_won: boolean; is_lost: boolean };
type PipelineLite = { id: string; name: string; tenant_id: string };

/**
 * Vista founder cross-tenant de todos los leads del CRM.
 * Filtros: tenant + búsqueda por nombre/email/teléfono.
 * Solo lectura — no editamos leads desde acá (el owner los gestiona).
 */
export default async function FounderLeadsPage({
  searchParams
}: {
  searchParams: Promise<{ tenant?: string; q?: string; limit?: string }>;
}) {
  await requireSuperAdmin();
  const sp = await searchParams;
  const tenantFilter = sp.tenant?.trim() || '';
  const q = sp.q?.trim() ?? '';
  const limit = Math.min(500, Math.max(20, parseInt(sp.limit ?? '100', 10) || 100));

  const svc = getServiceClient();

  // Lista de tenants para el dropdown de filtro
  const { data: tenantsRaw } = await svc
    .from('tenants').select('id, name, slug').order('name');
  const tenants = (tenantsRaw ?? []) as TenantOpt[];
  const tenantById = new Map(tenants.map((t) => [t.id, t]));

  // Query leads defensiva (crm_leads puede no existir si migration 0030 pendiente)
  let leads: Lead[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (svc.from('crm_leads') as any)
      .select('id, tenant_id, pipeline_id, stage_id, name, email, phone, value_cents, currency, source, notes, assigned_to_user_id, created_at')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (tenantFilter) query = query.eq('tenant_id', tenantFilter);
    if (q) {
      const safe = q.replace(/[%_]/g, '\\$&');
      query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`);
    }
    const { data, error } = await query;
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    leads = (data ?? []) as Lead[];
  } catch { migrationMissing = true; }

  // Traer stages + pipelines para enriquecer las rows con etapa/pipeline names
  const stageIds = Array.from(new Set(leads.map((l) => l.stage_id)));
  const pipelineIds = Array.from(new Set(leads.map((l) => l.pipeline_id)));
  const stageById = new Map<string, StageLite>();
  const pipelineById = new Map<string, PipelineLite>();
  if (stageIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sRaw } = await (svc.from('crm_stages') as any)
      .select('id, name, color, is_won, is_lost').in('id', stageIds);
    for (const s of ((sRaw ?? []) as StageLite[])) stageById.set(s.id, s);
  }
  if (pipelineIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pRaw } = await (svc.from('crm_pipelines') as any)
      .select('id, name, tenant_id').in('id', pipelineIds);
    for (const p of ((pRaw ?? []) as PipelineLite[])) pipelineById.set(p.id, p);
  }

  // Aggregates para el header
  const totalValue = leads.reduce((s, l) => s + Number(l.value_cents ?? 0), 0);
  const wonCount = leads.filter((l) => {
    const s = stageById.get(l.stage_id);
    return s?.is_won;
  }).length;

  return (
    <div className="max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads (todos los sitios)</h1>
        <p className="text-white/60 text-sm mt-1">
          Vista cross-tenant de todos los leads cargados en el CRM de cualquier sitio de la plataforma.
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          ⚠️ Migración 0030 (forms + CRM) pendiente en la DB.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Leads mostrados" value={String(leads.length)} sub={leads.length === limit ? `(máx. ${limit})` : ''} />
        <Stat label="Ganados" value={String(wonCount)} />
        <Stat label="Valor total" value={totalValue > 0 ? `$ ${(totalValue / 100).toLocaleString('es-AR')}` : '—'} />
        <Stat label="Sitios con leads" value={String(new Set(leads.map((l) => l.tenant_id)).size)} />
      </div>

      <form method="get" className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Sitio</label>
          <select name="tenant" defaultValue={tenantFilter}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm min-w-[220px]">
            <option value="">Todos los sitios</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.slug})</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] text-white/50 uppercase tracking-wider block mb-1">Buscar</label>
          <input name="q" defaultValue={q} placeholder="Nombre, email o teléfono"
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
        {(tenantFilter || q) && (
          <Link href="/founder/leads" className="text-xs text-white/50 hover:text-white px-3 py-2">
            Limpiar
          </Link>
        )}
      </form>

      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
          {tenantFilter || q ? 'Ningún lead matchea los filtros.' : 'No hay leads en ningún sitio todavía.'}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="text-white/50 uppercase tracking-wider text-[10px] bg-white/[0.03]">
              <tr>
                <th className="text-left px-3 py-2">Fecha</th>
                <th className="text-left px-3 py-2">Sitio</th>
                <th className="text-left px-3 py-2">Nombre</th>
                <th className="text-left px-3 py-2">Email</th>
                <th className="text-left px-3 py-2">Teléfono</th>
                <th className="text-left px-3 py-2">Pipeline · Etapa</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Origen</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => {
                const t = tenantById.get(l.tenant_id);
                const stage = stageById.get(l.stage_id);
                const pipeline = pipelineById.get(l.pipeline_id);
                return (
                  <tr key={l.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-white/60 whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-3 py-2">
                      {t ? (
                        <Link href={`/founder/tenants/${t.slug}`} className="hover:underline text-white/80">
                          {t.name}
                        </Link>
                      ) : <span className="text-white/40">—</span>}
                    </td>
                    <td className="px-3 py-2 font-medium">{l.name ?? '—'}</td>
                    <td className="px-3 py-2 text-white/70">{l.email ?? '—'}</td>
                    <td className="px-3 py-2 text-white/70">{l.phone ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="text-white/50">{pipeline?.name ?? '—'}</span>
                      {stage && (
                        <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded"
                          style={{
                            background: `${stage.color ?? '#a855f7'}22`,
                            color: stage.color ?? '#a855f7'
                          }}>
                          {stage.name}{stage.is_won ? ' ✓' : stage.is_lost ? ' ✗' : ''}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {l.value_cents ? `$ ${(Number(l.value_cents) / 100).toLocaleString('es-AR')}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-white/50 text-[11px]">{l.source ?? 'manual'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
