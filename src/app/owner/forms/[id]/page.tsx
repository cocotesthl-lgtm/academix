import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import {
  addFieldAction, deleteFieldAction, moveFieldAction,
  updateFormMetaAction
} from '@/lib/forms/actions';
import { setFormPipelineAction } from '@/lib/crm/actions';

export const dynamic = 'force-dynamic';

type FormRow = {
  id: string; slug: string; title: string; description: string | null;
  success_message: string | null; redirect_url: string | null;
  submit_label: string | null; notify_email: string | null;
  default_pipeline_id: string | null; default_stage_id: string | null;
};

type FieldRow = {
  id: string; position: number; field_type: string;
  name: string; label: string; placeholder: string | null;
  required: boolean; options: Array<{ value: string; label: string }> | null;
  help_text: string | null;
};

type Submission = {
  id: string; data: Record<string, unknown>; submitted_at: string;
  submitter_name: string | null; submitter_email: string | null; submitter_phone: string | null;
};

export default async function FormEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formRaw } = await (svc.from('forms') as any)
    .select('id, slug, title, description, success_message, redirect_url, submit_label, notify_email, default_pipeline_id, default_stage_id')
    .eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const form = formRaw as FormRow | null;
  if (!form) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fields } = await (svc.from('form_fields') as any)
    .select('id, position, field_type, name, label, placeholder, required, options, help_text')
    .eq('form_id', id)
    .order('position');
  const fieldList = (fields ?? []) as FieldRow[];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submissions } = await (svc.from('form_submissions') as any)
    .select('id, data, submitted_at, submitter_name, submitter_email, submitter_phone')
    .eq('form_id', id)
    .order('submitted_at', { ascending: false })
    .limit(50);
  const subs = (submissions ?? []) as Submission[];

  // URL pública del form
  const publicPath = `/f/${form.slug}`;

  // Pipelines + stages del tenant para el conector CRM (defensivo si migration falta)
  type PipelineLite = { id: string; name: string };
  type StageLite = { id: string; pipeline_id: string; name: string; position: number };
  let pipelines: PipelineLite[] = [];
  let stagesAll: StageLite[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pr = await (svc.from('crm_pipelines') as any)
      .select('id, name').eq('tenant_id', tenant.id).order('position');
    pipelines = (pr.data ?? []) as PipelineLite[];
    if (pipelines.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sr = await (svc.from('crm_stages') as any)
        .select('id, pipeline_id, name, position')
        .in('pipeline_id', pipelines.map((p) => p.id))
        .order('position');
      stagesAll = (sr.data ?? []) as StageLite[];
    }
  } catch { /* migration pendiente */ }
  const stagesByPipeline: Record<string, StageLite[]> = {};
  for (const s of stagesAll) {
    if (!stagesByPipeline[s.pipeline_id]) stagesByPipeline[s.pipeline_id] = [];
    stagesByPipeline[s.pipeline_id].push(s);
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/owner/forms" className="text-xs text-white/50 hover:text-white">← Volver a formularios</Link>
          <h1 className="text-2xl font-bold mt-1">{form.title}</h1>
          <p className="text-white/60 text-sm mt-1">
            URL pública: <code className="text-white/80 font-mono text-xs">{publicPath}</code>
          </p>
        </div>
      </div>

      {/* Meta del form */}
      <details className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <summary className="cursor-pointer font-semibold text-sm select-none">⚙️ Configuración del formulario</summary>
        <form action={updateFormMetaAction} className="space-y-3 mt-4">
          <input type="hidden" name="id" value={form.id} />
          <div>
            <label className="text-xs text-white/60">Título</label>
            <input name="title" defaultValue={form.title} required
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">Descripción</label>
            <input name="description" defaultValue={form.description ?? ''}
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/60">Texto del botón</label>
              <input name="submit_label" defaultValue={form.submit_label ?? 'Enviar'}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-white/60">Email para notificar envíos</label>
              <input name="notify_email" type="email" defaultValue={form.notify_email ?? ''}
                className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-white/60">Mensaje de éxito tras enviar</label>
            <input name="success_message" defaultValue={form.success_message ?? '¡Gracias!'}
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60">URL de redirección post-envío (opcional)</label>
            <input name="redirect_url" defaultValue={form.redirect_url ?? ''} placeholder="https://… o /gracias"
              className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90 transition">
            Guardar configuración
          </button>
        </form>
      </details>

      {/* Campos del form */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-4">
        <h2 className="font-semibold text-sm">🧩 Campos del formulario</h2>
        {fieldList.length === 0 ? (
          <p className="text-xs text-white/40">Sin campos todavía.</p>
        ) : (
          <ul className="space-y-2">
            {fieldList.map((f, idx) => (
              <li key={f.id} className="rounded-lg border border-white/10 p-3 flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <form action={moveFieldAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="form_id" value={form.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button disabled={idx === 0} className="text-white/50 hover:text-white disabled:opacity-20 text-xs">▲</button>
                  </form>
                  <form action={moveFieldAction}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="form_id" value={form.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button disabled={idx === fieldList.length - 1} className="text-white/50 hover:text-white disabled:opacity-20 text-xs">▼</button>
                  </form>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {f.label}
                    {f.required && <span className="text-rose-400 ml-1">*</span>}
                  </div>
                  <div className="text-[11px] text-white/40">
                    <span className="font-mono">{f.field_type}</span> · key: <span className="font-mono">{f.name}</span>
                    {f.placeholder && <> · placeholder: "{f.placeholder}"</>}
                  </div>
                  {f.options && f.options.length > 0 && (
                    <div className="text-[10px] text-white/40 mt-0.5">
                      Opciones: {f.options.map((o) => o.label).join(', ')}
                    </div>
                  )}
                </div>
                <form action={deleteFieldAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <input type="hidden" name="form_id" value={form.id} />
                  <button className="text-xs px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10">✕</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <details className="pt-3 border-t border-white/10">
          <summary className="cursor-pointer text-xs font-semibold text-white/80 select-none">+ Agregar campo</summary>
          <form action={addFieldAction} className="grid grid-cols-2 gap-2 mt-3">
            <input type="hidden" name="form_id" value={form.id} />
            <select name="field_type" className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
              <option value="text">📝 Texto</option>
              <option value="email">✉ Email</option>
              <option value="phone">📞 Teléfono</option>
              <option value="textarea">📄 Texto largo</option>
              <option value="select">🔽 Lista desplegable</option>
              <option value="checkbox">☑ Checkbox</option>
              <option value="number">🔢 Número</option>
            </select>
            <input name="label" required placeholder="Etiqueta (ej. Empresa)"
              className="col-span-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input name="placeholder" placeholder="Placeholder (opcional)"
              className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <textarea name="options" rows={2} placeholder="Opciones para select, una por línea (ignorado en otros tipos)"
              className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono" />
            <input name="help_text" placeholder="Texto de ayuda (opcional)"
              className="col-span-2 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <label className="col-span-2 flex items-center gap-2 text-xs">
              <input type="checkbox" name="required" /> Campo obligatorio
            </label>
            <button className="col-span-2 rounded bg-white text-black text-sm font-semibold py-2 hover:bg-white/90">
              Agregar campo
            </button>
          </form>
        </details>
      </div>

      {/* CRM connection */}
      {pipelines.length > 0 && (
        <details className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5" open>
          <summary className="cursor-pointer font-semibold text-sm select-none">
            📊 Conectar al CRM (crear lead automático con cada envío)
          </summary>
          <form action={setFormPipelineAction} className="space-y-3 mt-4">
            <input type="hidden" name="form_id" value={form.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60">Pipeline donde caen los leads</label>
                <select
                  name="pipeline_id"
                  defaultValue={form.default_pipeline_id ?? ''}
                  className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
                >
                  <option value="">— Sin pipeline (no crear lead) —</option>
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/60">Etapa default</label>
                <select
                  name="stage_id"
                  defaultValue={form.default_stage_id ?? ''}
                  className="w-full mt-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
                >
                  <option value="">— Elegí una etapa —</option>
                  {form.default_pipeline_id && (stagesByPipeline[form.default_pipeline_id] ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                  {!form.default_pipeline_id && pipelines.length > 0 && (stagesByPipeline[pipelines[0].id] ?? []).map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[11px] text-white/55">
              💡 Cuando se conecta a un pipeline, cada envío del formulario crea automáticamente un lead
              en la etapa elegida. Vas a verlos en <Link href="/owner/crm" className="underline">/owner/crm</Link>.
              Si necesitás cambiar de etapa por pipeline, guardá, refrescá y ajustá.
            </p>
            <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
              Guardar conexión
            </button>
          </form>
        </details>
      )}

      {/* Submissions */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">📥 Envíos recibidos ({subs.length})</h2>
        </div>
        {subs.length === 0 ? (
          <p className="text-xs text-white/40">Sin envíos todavía. Compartí la URL pública del formulario o embebelo en el hero.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-white/50">
                <tr>
                  <th className="py-2 pr-4">Fecha</th>
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
                    <td className="py-2 pr-4">{s.submitter_name ?? '—'}</td>
                    <td className="py-2 pr-4">{s.submitter_email ?? '—'}</td>
                    <td className="py-2 pr-4">{s.submitter_phone ?? '—'}</td>
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
        )}
      </div>
    </div>
  );
}
