import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type SubRow = {
  id: string;
  form_id: string;
  data: Record<string, unknown>;
  submitter_name: string | null;
  submitter_email: string | null;
  submitter_phone: string | null;
  submitted_at: string;
  lead_id: string | null;
};

type FormLite = { id: string; title: string };

export default async function CrmPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let subs: SubRow[] = [];
  let forms: FormLite[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subRes = await (svc.from('form_submissions') as any)
      .select('id, form_id, data, submitter_name, submitter_email, submitter_phone, submitted_at, lead_id')
      .eq('tenant_id', tenant.id)
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (subRes.error?.message?.includes('does not exist')) migrationMissing = true;
    subs = (subRes.data ?? []) as SubRow[];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fRes = await (svc.from('forms') as any).select('id, title').eq('tenant_id', tenant.id);
    forms = (fRes.data ?? []) as FormLite[];
  } catch {
    migrationMissing = true;
  }

  const formTitleById = new Map(forms.map((f) => [f.id, f.title]));

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">📊 CRM — Leads</h1>
        <p className="text-white/60 text-sm mt-1">
          Gestión de leads y pipelines (kanban + asignación al equipo).
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🚧</span>
          <div className="space-y-2 text-sm">
            <h2 className="font-semibold text-indigo-200">CRM Pipelines — próxima fase</h2>
            <p className="text-white/70">
              El tablero Kanban completo (pipelines con etapas drag&drop, asignación a miembros del equipo,
              historial por lead, notas internas, valor del deal) viene en la próxima entrega.
            </p>
            <p className="text-white/55 text-xs">
              Por ahora, abajo podés ver todos los envíos de tus formularios — esos son tus leads crudos.
              Cuando habilitemos pipelines, vas a poder mover cada uno por etapas (Nuevo → Contactado → Cotizado → Cerrado).
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm">📥 Leads (envíos de formularios)</h2>
          <Link href="/owner/forms" className="text-xs text-white/60 hover:text-white">
            Ver formularios →
          </Link>
        </div>

        {!migrationMissing && subs.length === 0 ? (
          <p className="text-xs text-white/40 py-4 text-center">
            Sin leads aún. Creá un formulario y compartilo o embebelo en tu hero.
          </p>
        ) : !migrationMissing ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-white/50">
                <tr>
                  <th className="py-2 pr-4">Fecha</th>
                  <th className="py-2 pr-4">Formulario</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Teléfono</th>
                  <th className="py-2 pr-4">Datos</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-xs text-white/60 whitespace-nowrap">
                      {new Date(s.submitted_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {formTitleById.get(s.form_id) ?? '—'}
                    </td>
                    <td className="py-2 pr-4">{s.submitter_name ?? '—'}</td>
                    <td className="py-2 pr-4">
                      {s.submitter_email ? (
                        <a href={`mailto:${s.submitter_email}`} className="text-indigo-300 hover:underline">{s.submitter_email}</a>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      {s.submitter_phone ? (
                        <a href={`tel:${s.submitter_phone}`} className="text-indigo-300 hover:underline">{s.submitter_phone}</a>
                      ) : '—'}
                    </td>
                    <td className="py-2 pr-4 text-xs text-white/55 max-w-md">
                      <details>
                        <summary className="cursor-pointer text-white/70">ver datos</summary>
                        <pre className="text-[10px] whitespace-pre-wrap break-all mt-1 text-white/55">{JSON.stringify(s.data, null, 2)}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
