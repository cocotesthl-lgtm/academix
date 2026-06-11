'use client';

import { useState, useMemo } from 'react';
import type { EventDate, SeatZone } from '@/lib/calendar/types';

/**
 * Selector de tickets para cursos con calendar_mode='event_tickets'.
 * Reemplaza el CouponInput cuando el modo del curso es evento.
 *
 * Flow:
 *  1. Comprador elige una fecha (evento) de la lista.
 *  2. Si el evento es seat_mode='none' → input de cantidad (1..capacity-tomados).
 *  3. Si es seat_mode='grid' → grid clickeable de asientos (los tomados aparecen
 *     deshabilitados). Multi-selección.
 *  4. Submit → POST a /api/checkout/[courseId] con event_date_id + qty/seats.
 *
 * El precio = course.price_cents × qty. Si el comprador eligió 3 tickets,
 * paga 3 × $X.
 */
export function TicketPicker({
  courseId,
  priceCents,
  currency,
  primary,
  events,
  takenSeatsByDate,
  defaultEmail = ''
}: {
  courseId: string;
  priceCents: number;
  currency: string;
  primary: string;
  events: EventDate[];
  /** Por cada calendar_date.id, set de seat_label tomados. Solo para
   *  seat_mode=grid. Para 'none' usamos un contador de tickets vendidos. */
  takenSeatsByDate: Record<string, { taken: Set<string>; soldCount: number }>;
  defaultEmail?: string;
}) {
  const [selectedDateId, setSelectedDateId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [seats, setSeats] = useState<string[]>([]);

  const event = useMemo(
    () => events.find((e) => e.id === selectedDateId) ?? null,
    [events, selectedDateId]
  );

  const isFree = priceCents === 0;
  const taken = event ? takenSeatsByDate[event.id] : null;
  const availableCount = event
    ? Math.max(0, event.capacity - (taken?.soldCount ?? 0))
    : 0;

  const hasSeats = event && (event.seat_mode === 'grid' || event.seat_mode === 'zones');
  const totalTickets = hasSeats ? seats.length : qty;

  // Cálculo del total. En modo zones: precio por seat depende de la zona
  // (label tiene formato "zoneId:rowChar+colNum"). En grid simple: precio base.
  const totalCents = useMemo(() => {
    if (!event) return 0;
    if (event.seat_mode === 'zones') {
      return seats.reduce((sum, label) => {
        const zoneId = label.split(':')[0];
        const zone = (event.seat_zones ?? []).find((z) => z.id === zoneId);
        const mult = zone?.price_multiplier ?? 1;
        return sum + Math.round(priceCents * mult);
      }, 0);
    }
    return totalTickets * priceCents;
  }, [event, seats, totalTickets, priceCents]);

  const dataReady = !!event && totalTickets > 0 && totalTickets <= availableCount;

  function pickDate(id: string) {
    setSelectedDateId(id);
    setQty(1);
    setSeats([]);
  }

  function toggleSeat(label: string) {
    setSeats((prev) =>
      prev.includes(label) ? prev.filter((s) => s !== label) : [...prev, label]
    );
  }

  return (
    <form action={`/api/checkout/${courseId}`} method="post" className="space-y-3">
      <input type="hidden" name="event_date_id" value={selectedDateId} />
      <input type="hidden" name="ticket_qty" value={totalTickets} />
      {hasSeats && (
        <input type="hidden" name="ticket_seats" value={seats.join(',')} />
      )}
      {defaultEmail && <input type="hidden" name="buyer_email" value={defaultEmail} />}

      {/* ─── Lista de eventos ─── */}
      <div>
        <h3 className="font-semibold text-sm mb-2">Elegí la fecha</h3>
        {events.length === 0 ? (
          <p className="text-sm text-black/55 rounded border border-dashed border-black/15 p-4 text-center">
            No hay eventos próximos. Volvé pronto.
          </p>
        ) : (
          <div className="space-y-1.5">
            {events.map((e) => {
              const taken = takenSeatsByDate[e.id];
              const left = Math.max(0, e.capacity - (taken?.soldCount ?? 0));
              const dateObj = new Date(e.date + 'T12:00:00');
              const dateLabel = dateObj.toLocaleDateString('es-AR', {
                weekday: 'short', day: '2-digit', month: 'long', year: 'numeric'
              });
              const timeFrom = `${String(Math.floor(e.start_min / 60)).padStart(2, '0')}:${String(e.start_min % 60).padStart(2, '0')}`;
              const timeTo = `${String(Math.floor(e.end_min / 60)).padStart(2, '0')}:${String(e.end_min % 60).padStart(2, '0')}`;
              const isSel = selectedDateId === e.id;
              const isSold = left === 0;
              return (
                <button
                  key={e.id}
                  type="button"
                  disabled={isSold}
                  onClick={() => pickDate(e.id)}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    isSel
                      ? 'border-transparent text-white'
                      : isSold
                        ? 'border-black/10 text-black/30 cursor-not-allowed bg-black/[0.02]'
                        : 'border-black/15 hover:border-black/40 bg-white'
                  }`}
                  style={isSel ? { background: primary } : undefined}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm capitalize">{dateLabel}</div>
                      <div className={`text-xs mt-0.5 ${isSel ? 'text-white/80' : 'text-black/55'}`}>
                        {timeFrom} – {timeTo}
                        {e.seat_mode === 'grid' && ' · 🪑 con asientos'}
                      </div>
                    </div>
                    <div className="text-xs font-semibold shrink-0">
                      {isSold ? 'AGOTADO' : `${left} ${left === 1 ? 'lugar' : 'lugares'}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Selector de tickets / asientos ─── */}
      {event && (
        <div className="rounded-lg border border-black/15 bg-black/[0.02] p-4 space-y-3">
          {event.seat_mode === 'none' && (
            <>
              <label className="block text-xs text-black/60 mb-1">Cantidad de tickets</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-9 h-9 rounded-full border border-black/15 text-lg hover:bg-black/[0.03]"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={availableCount}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(availableCount, parseInt(e.target.value || '1', 10))))}
                  className="w-16 text-center rounded border border-black/15 px-2 py-1.5"
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(availableCount, q + 1))}
                  className="w-9 h-9 rounded-full border border-black/15 text-lg hover:bg-black/[0.03]"
                >
                  +
                </button>
                <span className="text-xs text-black/55 ml-2">{availableCount} disponibles</span>
              </div>
            </>
          )}

          {event.seat_mode === 'grid' && (
            <SeatGrid
              zonePrefix=""
              rows={event.seat_rows}
              cols={event.seat_cols}
              takenSet={taken?.taken ?? new Set()}
              selected={seats}
              onToggle={toggleSeat}
              primary={primary}
            />
          )}

          {event.seat_mode === 'zones' && (
            <ZonesView
              zones={event.seat_zones ?? []}
              takenSet={taken?.taken ?? new Set()}
              selected={seats}
              onToggle={toggleSeat}
              priceCents={priceCents}
              currency={currency}
              primary={primary}
            />
          )}

          {/* Datos del comprador */}
          {!defaultEmail && (
            <div>
              <label className="block text-xs text-black/60 mb-1">Tu email *</label>
              <input
                name="buyer_email"
                type="email"
                required
                placeholder="vos@email.com"
                className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-black/60 mb-1">Tu nombre *</label>
            <input
              name="buyer_name"
              type="text"
              required
              placeholder="Juan Pérez"
              className="w-full rounded border border-black/15 bg-white px-3 py-2 text-sm"
            />
          </div>

          {/* Total + submit. Look estilo recibo: currency al frente,
              número compacto sin parsing de "$ X ARS" en columnas. */}
          <div className="pt-3 border-t border-black/10 space-y-3">
            <div className="rounded-lg bg-black/[0.04] px-4 py-3">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-[11px] text-black/55 uppercase tracking-wider font-medium">Total</span>
                {totalTickets > 0 && !isFree && (
                  <span className="text-[11px] text-black/45 whitespace-nowrap">
                    {totalTickets} × ${(priceCents / 100).toLocaleString('es-AR')}
                  </span>
                )}
              </div>
              <div className="font-bold leading-none flex items-baseline gap-1.5">
                {isFree ? (
                  <span className="text-2xl">Gratis</span>
                ) : (
                  <>
                    <span className="text-xs text-black/55 font-medium tracking-wide">{currency}</span>
                    <span className="text-2xl">{(totalCents / 100).toLocaleString('es-AR')}</span>
                  </>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={!dataReady}
              className="w-full rounded-md py-3 px-4 font-semibold text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: primary }}
            >
              <span>🎫</span>
              <span>
                {isFree
                  ? 'Reservar mi lugar'
                  : totalTickets > 0
                    ? `Comprar ${totalTickets} ${totalTickets === 1 ? 'ticket' : 'tickets'}`
                    : 'Comprar tickets'}
              </span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function SeatGrid({
  zonePrefix, rows, cols, takenSet, selected, onToggle, primary, zoneColor
}: {
  /** Prefijo de zona: "vip:" → labels son "vip:A1". Vacío → "A1". */
  zonePrefix: string;
  rows: number;
  cols: number;
  takenSet: Set<string>;
  selected: string[];
  onToggle: (label: string) => void;
  primary: string;
  zoneColor?: string;
}) {
  if (rows < 1 || cols < 1) {
    return <p className="text-sm text-black/55 text-center">Sin mapa de asientos configurado.</p>;
  }
  // Etiquetas: A1, A2, ..., B1, B2, ...
  const rowChar = (i: number) => String.fromCharCode(65 + i);
  const accent = zoneColor || primary;

  return (
    <div>
      <label className="block text-xs text-black/60 mb-2">
        Elegí tus asientos ({selected.length} {selected.length === 1 ? 'asiento seleccionado' : 'asientos seleccionados'})
      </label>
      <div className="rounded-lg bg-black/[0.04] p-3 overflow-x-auto">
        {/* "ESCENARIO" indicator */}
        <div className="text-center text-[10px] uppercase tracking-widest text-black/40 mb-2 border-b border-black/15 pb-1">
          escenario / frente
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: rows }, (_, r) => (
            <div key={r} className="flex items-center justify-center gap-1.5">
              <span className="w-5 text-xs font-mono text-black/40 text-right">
                {rowChar(r)}
              </span>
              {Array.from({ length: cols }, (_, c) => {
                const label = `${zonePrefix}${rowChar(r)}${c + 1}`;
                const isTaken = takenSet.has(label);
                const isSel = selected.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={isTaken}
                    onClick={() => onToggle(label)}
                    title={label}
                    className={`w-7 h-7 rounded text-[10px] font-semibold transition ${
                      isTaken
                        ? 'bg-black/15 text-black/30 cursor-not-allowed'
                        : isSel
                          ? 'text-white shadow-md'
                          : 'bg-white border border-black/15 hover:border-black/40'
                    }`}
                    style={isSel ? { background: accent } : undefined}
                  >
                    {c + 1}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-3 text-[10px] text-black/55">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-white border border-black/15 inline-block" /> Libre</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded inline-block" style={{ background: accent }} /> Elegido</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-black/15 inline-block" /> Ocupado</span>
        </div>
      </div>
    </div>
  );
}

function ZonesView({
  zones, takenSet, selected, onToggle, priceCents, currency, primary
}: {
  zones: SeatZone[];
  takenSet: Set<string>;
  selected: string[];
  onToggle: (label: string) => void;
  priceCents: number;
  currency: string;
  primary: string;
}) {
  if (zones.length === 0) {
    return <p className="text-sm text-black/55 text-center">Sin zonas configuradas.</p>;
  }
  return (
    <div className="space-y-4">
      {/* Indicador "escenario" arriba */}
      <div className="text-center text-[10px] uppercase tracking-widest text-black/40 pb-2 border-b border-black/15">
        escenario / frente
      </div>
      {zones.map((z) => {
        const zoneSelected = selected.filter((s) => s.startsWith(`${z.id}:`)).length;
        const zonePrice = Math.round(priceCents * z.price_multiplier);
        return (
          <div key={z.id} className="rounded-lg p-3" style={{ background: `${z.color ?? '#999'}10` }}>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded" style={{ background: z.color ?? '#999' }} />
                <strong className="text-sm">{z.name}</strong>
                <span className="text-xs text-black/55">
                  ${(zonePrice / 100).toLocaleString('es-AR')} {currency}/asiento
                  {z.price_multiplier !== 1 && ` (× ${z.price_multiplier})`}
                </span>
              </div>
              {zoneSelected > 0 && (
                <span className="text-xs font-semibold" style={{ color: z.color ?? primary }}>
                  {zoneSelected} elegido{zoneSelected > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <SeatGrid
              zonePrefix={`${z.id}:`}
              rows={z.rows}
              cols={z.cols}
              takenSet={takenSet}
              selected={selected}
              onToggle={onToggle}
              primary={primary}
              zoneColor={z.color}
            />
          </div>
        );
      })}
    </div>
  );
}
