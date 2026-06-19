import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { setReservationStatusAction } from '@/lib/venues/actions';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

type Row = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  reservation_date: string;
  reservation_time: string | null;
  party_size: number;
  notes: string | null;
  status: string;
  created_at: string;
  courses: { title: string } | null;
  venues: { name: string } | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending:   '🟡 Pendiente',
  confirmed: '🟢 Confirmada',
  cancelled: '⚫ Cancelada',
  completed: '✅ Completada',
  no_show:   '🚫 No vino'
};

export default async function ReservasPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  let migrationMissing = false;
  let rows: Row[] = [];
  try {
    const { data, error } = await svc
      .from('reservations')
      .select('id, customer_name, customer_email, customer_phone, reservation_date, reservation_time, party_size, notes, status, created_at, courses(title), venues(name)')
      .eq('tenant_id', tenant.id)
      .order('reservation_date', { ascending: true })
      .limit(200);
    if (error?.message?.includes('does not exist')) migrationMissing = true;
    rows = (data ?? []) as unknown as Row[];
  } catch { migrationMissing = true; }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="📅 Reservas"
        description="Acá ves todas las reservas que recibís de productos con sedes (tiro, gym, restaurante, etc.). Confirmá o cancelá una por una."
      />

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-200">
          ⚠️ Falta correr la migración. Pegá <code className="text-xs bg-black/30 px-1.5 py-0.5 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en Supabase SQL Editor.
        </div>
      )}

      {!migrationMissing && rows.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-white/40 text-sm">
          Sin reservas aún. Cuando un cliente reserve en tu storefront, aparece acá.
        </div>
      )}

      {!migrationMissing && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex flex-wrap gap-4 items-start">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">
                  {r.customer_name} <span className="text-white/45 font-normal text-xs">· {r.party_size} {r.party_size === 1 ? 'persona' : 'personas'}</span>
                </div>
                <div className="text-xs text-white/55 mt-0.5">
                  {r.courses?.title ?? '—'} {r.venues?.name && <>· 📍 {r.venues.name}</>}
                </div>
                <div className="text-xs text-white/45 mt-1">
                  📅 {new Date(r.reservation_date).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {r.reservation_time && <> · 🕐 {r.reservation_time}</>}
                </div>
                <div className="text-[11px] text-white/45 mt-1 font-mono">
                  ✉️ {r.customer_email} {r.customer_phone && <>· 📞 {r.customer_phone}</>}
                </div>
                {r.notes && <div className="text-xs text-white/55 mt-1.5 italic">&quot;{r.notes}&quot;</div>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs">{STATUS_LABEL[r.status] ?? r.status}</span>
                <div className="flex gap-1.5">
                  {r.status !== 'confirmed' && (
                    <form action={setReservationStatusAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30">Confirmar</button>
                    </form>
                  )}
                  {r.status !== 'cancelled' && (
                    <form action={setReservationStatusAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <button className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-rose-500/20 text-rose-200 hover:bg-rose-500/30">Cancelar</button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
