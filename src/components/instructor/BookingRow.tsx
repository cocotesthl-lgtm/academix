'use client';

import { useState, useTransition } from 'react';
import { rescheduleBookingAction, cancelBookingAction } from '@/lib/instructors/actions';
import type { BookingSlot } from '@/lib/calendar/types';

type Booking = {
  id: string;
  slot_start: string;
  slot_end: string;
  status: string;
  buyer_name: string | null;
  buyer_email: string | null;
};

/**
 * Fila de booking en el detail del instructor. Si tiene permiso para
 * reagendar, muestra el botón → abre modal con grid de slots disponibles.
 * Cancelar también detrás del mismo permiso (mata el slot).
 */
export function BookingRow({
  booking,
  canReschedule,
  availableSlots
}: {
  booking: Booking;
  canReschedule: boolean;
  availableSlots: BookingSlot[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [pending, start] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState('');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [error, setError] = useState('');

  function reschedule() {
    if (!selectedSlot) return;
    const fd = new FormData();
    fd.set('booking_id', booking.id);
    fd.set('new_slot_start', selectedSlot);
    setError('');
    start(async () => {
      await rescheduleBookingAction(fd);
      setModalOpen(false);
      setSelectedSlot('');
    });
  }

  function cancel() {
    if (!confirm('¿Cancelar esta reserva? El alumno NO recibe notificación automática.')) return;
    const fd = new FormData();
    fd.set('booking_id', booking.id);
    start(async () => { await cancelBookingAction(fd); });
  }

  // Agrupamos slots por día
  const groups: Array<[string, BookingSlot[]]> = (() => {
    const m = new Map<string, BookingSlot[]>();
    for (const s of availableSlots) {
      if (s.taken) continue;
      const d = s.start.slice(0, 10);
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <>
      <tr className="border-t border-white/5">
        <td className="px-3 py-2 whitespace-nowrap">
          {new Date(booking.slot_start).toLocaleString('es-AR', {
            weekday: 'short', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit'
          })}
        </td>
        <td className="px-3 py-2 text-white/70">{booking.buyer_name ?? booking.buyer_email ?? '—'}</td>
        <td className="px-3 py-2 text-right">
          {canReschedule ? (
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                disabled={pending}
                className="text-xs px-3 py-1 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20"
              >
                🔄 Reagendar
              </button>
              <button
                type="button"
                onClick={cancel}
                disabled={pending}
                className="text-xs px-3 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10"
              >
                ✕ Cancelar
              </button>
            </div>
          ) : (
            <span className="text-xs text-white/30">Sin permiso</span>
          )}
        </td>
      </tr>

      {/* Modal de reschedule */}
      {modalOpen && (
        <tr>
          <td colSpan={3} className="px-3 pb-4">
            <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold">Elegí el nuevo horario</h4>
                <button onClick={() => setModalOpen(false)} className="text-white/40 hover:text-white">✕</button>
              </div>
              {groups.length === 0 ? (
                <p className="text-sm text-white/60 text-center py-4">
                  No hay slots libres en la disponibilidad declarada. Pediles al owner que sume más bloques en /availability.
                </p>
              ) : (
                <div className="rounded-lg border border-white/10 bg-[#0a0a0a] max-h-[300px] overflow-y-auto">
                  {groups.map(([day, slots]) => {
                    const isOpen = openDay === day;
                    const date = new Date(day + 'T12:00:00');
                    return (
                      <div key={day} className="border-b border-white/5 last:border-b-0">
                        <button
                          type="button"
                          onClick={() => setOpenDay(isOpen ? null : day)}
                          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 text-sm"
                        >
                          <span className="capitalize">{date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</span>
                          <span className="text-xs text-white/45">{slots.length} libres {isOpen ? '▾' : '▸'}</span>
                        </button>
                        {isOpen && (
                          <div className="px-3 pb-3 flex flex-wrap gap-1.5">
                            {slots.map((s) => {
                              const time = new Date(s.start).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                              const isSel = selectedSlot === s.start;
                              return (
                                <button
                                  key={s.start}
                                  type="button"
                                  onClick={() => setSelectedSlot(isSel ? '' : s.start)}
                                  className={`text-xs px-3 py-1.5 rounded border transition ${
                                    isSel
                                      ? 'border-transparent bg-fuchsia-500 text-white'
                                      : 'border-white/15 hover:border-white/40'
                                  }`}
                                >
                                  {time}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedSlot && (
                <p className="text-xs text-emerald-300 mt-2">
                  Nueva fecha: {new Date(selectedSlot).toLocaleString('es-AR', {
                    weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              )}
              {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setModalOpen(false)} className="text-xs px-3 py-1.5 rounded border border-white/15 hover:bg-white/5">
                  Cerrar
                </button>
                <button
                  onClick={reschedule}
                  disabled={!selectedSlot || pending}
                  className="text-xs px-4 py-1.5 rounded bg-fuchsia-500 text-white font-semibold hover:bg-fuchsia-400 disabled:opacity-40"
                >
                  {pending ? 'Reagendando…' : 'Confirmar nueva fecha'}
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
