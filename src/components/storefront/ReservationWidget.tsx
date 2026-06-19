'use client';

import { useState } from 'react';

type Venue = { id: string; name: string; address: string | null };

export function ReservationWidget({
  tenantId, courseId, primary, venues, ctaText
}: {
  tenantId: string;
  courseId: string;
  primary: string;
  venues: Venue[];      // si está vacío, el widget igual funciona pero sin selector de sede
  ctaText: string;
}) {
  const [selectedVenue, setSelectedVenue] = useState<string>(venues[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [party, setParty] = useState(2);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mínimo: hoy
  const today = new Date().toISOString().slice(0, 10);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch(`/api/reservations/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          venue_id: selectedVenue || null,
          customer_name: name,
          customer_email: email,
          customer_phone: phone || undefined,
          reservation_date: date,
          reservation_time: time || undefined,
          party_size: party,
          notes: notes || undefined
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j?.error === 'invalid_email' ? 'Email inválido' : j?.error === 'missing_fields' ? 'Faltan datos obligatorios' : 'No se pudo enviar la reserva.');
        return;
      }
      setDone(true);
    } catch {
      setError('Error de red. Probá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-center">
        <div className="text-3xl mb-2">✅</div>
        <div className="font-semibold text-black">¡Reserva enviada!</div>
        <p className="text-sm text-black/60 mt-1">
          Te vamos a contactar a <strong>{email}</strong> para confirmarla.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {venues.length > 1 && (
        <div>
          <label className="block text-xs text-black/55 mb-1">Sede</label>
          <div className="grid sm:grid-cols-2 gap-2">
            {venues.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setSelectedVenue(v.id)}
                className={`text-left rounded-lg border px-3 py-2 transition text-sm ${
                  selectedVenue === v.id
                    ? 'border-black bg-black/5'
                    : 'border-black/15 hover:border-black/40'
                }`}
              >
                <div className="font-semibold">📍 {v.name}</div>
                {v.address && <div className="text-xs text-black/55 truncate">{v.address}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {venues.length === 1 && (
        <div className="text-xs text-black/55">
          📍 <strong>{venues[0].name}</strong>{venues[0].address && ` · ${venues[0].address}`}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-black/55 mb-1">Fecha</label>
          <input type="date" min={today} required value={date} onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-black/55 mb-1">Hora</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
            placeholder="20:30"
            className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-black/55 mb-1">¿Cuántas personas?</label>
        <input type="number" min={1} max={50} required value={party} onChange={(e) => setParty(Number(e.target.value))}
          className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-black/55 mb-1">Tu nombre</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-black/55 mb-1">Teléfono</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40}
            className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-black/55 mb-1">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200}
          className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-xs text-black/55 mb-1">Notas <span className="text-black/35">(opcional)</span></label>
        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500}
          placeholder="Alergias, preferencias, etc."
          className="w-full rounded border border-black/15 px-3 py-2 text-sm" />
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
      )}

      <button type="submit" disabled={submitting}
        className="w-full rounded-lg text-white font-semibold py-3 disabled:opacity-50"
        style={{ background: primary }}>
        {submitting ? 'Enviando…' : ctaText}
      </button>
      <p className="text-[10px] text-black/45 text-center">
        Reserva sin cargo. Te contactamos para confirmarla.
      </p>
    </form>
  );
}
