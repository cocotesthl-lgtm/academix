import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createVenueAction, updateVenueAction, deleteVenueAction } from '@/lib/venues/actions';
import { PageHeader } from '@/components/owner/PageHeader';
import { VenueScheduleEditor } from '@/components/owner/venues/VenueScheduleEditor';
import type { VenueHours } from '@/lib/venues/slots';

export const dynamic = 'force-dynamic';

type Venue = {
  id: string; name: string; address: string | null; phone: string | null;
  notes: string | null; active: boolean;
  hours?: VenueHours | null;
  blackout_dates?: string[] | null;
  slot_minutes?: number | null;
};

export default async function VenuesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let venues: Venue[] = [];
  try {
    const { data, error } = await svc
      .from('venues')
      .select('id, name, address, phone, notes, active, hours, blackout_dates, slot_minutes')
      .eq('tenant_id', tenant.id).order('position').order('created_at');
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    venues = (data ?? []) as Venue[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="📍 Sedes / Sucursales"
        description="Si tu negocio tiene varias ubicaciones (tiro, gym, escape, restaurante), cargá cada sede acá y después vinculalas a tus productos. El cliente elegirá sede antes de reservar."
      />

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && (
        <form action={createVenueAction} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
          <h2 className="font-semibold">+ Nueva sede</h2>
          <input name="name" required placeholder="Nombre (ej. Sede Palermo)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <input name="address" placeholder="Dirección (ej. Av. Santa Fe 1234)"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-3">
            <input name="phone" placeholder="Teléfono"
              className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
            <input name="notes" placeholder="Notas (ej. Horario L-V 10-19)"
              className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
          </div>
          <button className="rounded bg-white text-black text-sm font-semibold px-4 py-2">
            Crear sede
          </button>
        </form>
      )}

      {!migrationMissing && venues.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
          Sin sedes. Cargá la primera arriba.
        </div>
      )}

      {!migrationMissing && venues.length > 0 && (
        <div className="space-y-3">
          {venues.map((v) => (
            <details key={v.id} className="rounded-xl border border-white/10 bg-white/[0.02]">
              <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 select-none">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm flex items-center gap-2">
                    📍 {v.name}
                    {!v.active && <span className="text-[10px] uppercase bg-rose-500/20 text-rose-200 px-1.5 rounded">inactiva</span>}
                  </div>
                  {v.address && <div className="text-xs text-white/55 truncate">{v.address}</div>}
                </div>
                <span className="text-xs text-white/40">editar ▾</span>
              </summary>
              <form action={updateVenueAction} className="p-4 border-t border-white/10 space-y-3">
                <input type="hidden" name="id" value={v.id} />
                <input name="name" defaultValue={v.name} required placeholder="Nombre"
                  className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                <input name="address" defaultValue={v.address ?? ''} placeholder="Dirección"
                  className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input name="phone" defaultValue={v.phone ?? ''} placeholder="Teléfono"
                    className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                  <input name="notes" defaultValue={v.notes ?? ''} placeholder="Notas"
                    className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={v.active} />
                  Activa (aparece en el storefront)
                </label>
                <div className="flex items-center gap-3 pt-1">
                  <button type="submit" className="rounded bg-white text-black text-sm font-semibold px-4 py-1.5">
                    Guardar
                  </button>
                </div>
              </form>
              <div className="px-4 pb-4">
                <VenueScheduleEditor
                  venueId={v.id}
                  initialHours={(v.hours ?? {}) as VenueHours}
                  initialBlackouts={Array.isArray(v.blackout_dates) ? v.blackout_dates : []}
                  initialSlotMinutes={v.slot_minutes ?? 60}
                />
              </div>
              <form action={deleteVenueAction} className="px-4 pb-4">
                <input type="hidden" name="id" value={v.id} />
                <button type="submit" className="text-xs text-rose-300 hover:underline">
                  Eliminar sede
                </button>
              </form>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
