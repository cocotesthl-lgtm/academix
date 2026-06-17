import Link from 'next/link';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createFormAction, deleteFormAction } from '@/lib/forms/actions';

export const dynamic = 'force-dynamic';

type FormRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  created_at: string;
};

export default async function FormsListPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let forms: FormRow[] = [];
  let migrationMissing = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('forms') as any)
      .select('id, slug, title, description, created_at')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    forms = (data ?? []) as FormRow[];
  } catch {
    migrationMissing = true;
  }

  // Conteo de submissions por form (defensivo)
  const subCounts: Record<string, number> = {};
  if (!migrationMissing && forms.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: subs } = await (svc.from('form_submissions') as any)
        .select('form_id').eq('tenant_id', tenant.id);
      for (const s of (subs ?? []) as Array<{ form_id: string }>) {
        subCounts[s.form_id] = (subCounts[s.form_id] ?? 0) + 1;
      }
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">📝 Formularios</h1>
          <p className="text-white/60 text-sm mt-1">
            Creá formularios de contacto, captura de leads, encuestas. Cada envío queda guardado y
            puede crear automáticamente un lead en el CRM.
          </p>
        </div>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <form action={createFormAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="font-semibold">Crear nuevo formulario</h2>
          <input
            name="title"
            required
            placeholder="Título (ej. Contacto, Pedí tu cotización)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <input
            name="description"
            placeholder="Descripción corta (opcional)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <input
            name="notify_email"
            type="email"
            placeholder="Email para recibir los envíos (opcional)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 transition">
            + Crear formulario
          </button>
          <p className="text-[10px] text-white/40">
            Se crea con 3 campos por default (nombre, email, mensaje). Después podés agregar / quitar / reordenar.
          </p>
        </form>
      )}

      {!migrationMissing && forms.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
          Todavía no creaste ningún formulario.
        </div>
      )}

      {!migrationMissing && forms.length > 0 && (
        <div className="space-y-2">
          {forms.map((f) => (
            <div key={f.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/forms/${f.id}`} className="font-semibold hover:underline">{f.title}</Link>
                  <span className="text-[10px] text-white/40 font-mono">/{f.slug}</span>
                </div>
                {f.description && <div className="text-xs text-white/55 mt-1">{f.description}</div>}
                <div className="text-[11px] text-white/40 mt-1">
                  📥 {subCounts[f.id] ?? 0} {subCounts[f.id] === 1 ? 'envío recibido' : 'envíos recibidos'}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Link
                  href={`/forms/${f.id}`}
                  className="text-xs px-3 py-1.5 rounded border border-white/15 hover:bg-white/5 transition"
                >
                  Editar / Ver envíos
                </Link>
                <form action={deleteFormAction}>
                  <input type="hidden" name="id" value={f.id} />
                  <button
                    className="text-xs px-2.5 py-1.5 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 transition"
                    type="submit"
                  >✕</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
