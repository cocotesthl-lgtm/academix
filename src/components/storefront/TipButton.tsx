'use client';

import { useState } from 'react';

const PRESETS = [500, 1000, 2500, 5000];

export function TipButton({
  tenantId, courseId, buyerEmail, primary
}: {
  tenantId: string;
  courseId: string;
  buyerEmail: string;
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(1000);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const final = custom ? parseInt(custom, 10) : amount;
    if (!Number.isFinite(final) || final < 100) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tip/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: courseId,
          amount_cents: final * 100,
          message: message.trim(),
          buyer_email: buyerEmail
        })
      });
      const data = await res.json() as { init_point?: string; error?: string };
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        alert(`No se pudo procesar el tip: ${data.error ?? 'error desconocido'}`);
        setSubmitting(false);
      }
    } catch {
      alert('Error de red. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-white/15 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition group"
      >
        <div className="text-2xl mb-1">💸</div>
        <div className="font-semibold text-sm">Mandar una propina</div>
        <div className="text-[11px] text-white/55 mt-0.5">Para apoyar al creador</div>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">💸 Propina</h4>
        <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white text-sm">✕</button>
      </div>

      <div>
        <label className="text-xs text-white/55 block mb-1.5">Elegí monto</label>
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { setAmount(p); setCustom(''); }}
              className={`text-xs py-2 rounded border ${
                amount === p && !custom ? 'bg-white text-black border-white' : 'border-white/15 text-white/70 hover:bg-white/5'
              }`}
            >
              ${p.toLocaleString('es-AR')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-white/55 block mb-1">O monto custom (en ARS)</label>
        <input
          type="number"
          min={100}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Otro monto…"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs text-white/55 block mb-1">Mensaje (opcional)</label>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          placeholder="¡Gracias por el contenido!"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
        />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-md px-4 py-3 font-bold text-white shadow hover:shadow-lg transition disabled:opacity-60"
        style={{ background: primary }}
      >
        {submitting ? 'Procesando…' : `💸 Enviar tip de $${(custom ? parseInt(custom, 10) : amount).toLocaleString('es-AR')}`}
      </button>
      <p className="text-[10px] text-white/40 text-center">Pago seguro vía Mercado Pago</p>
    </div>
  );
}
