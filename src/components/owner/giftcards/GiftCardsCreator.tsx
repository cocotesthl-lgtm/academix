'use client';

import { useState, useTransition } from 'react';
import { createGiftCardAction, bulkCreateGiftCardsAction } from '@/lib/giftcards/actions';

/**
 * Formulario para crear gift cards. Dos modos:
 *   · Individual: con recipient/sender/mensaje custom → una card personalizada
 *   · Bulk: 20-100 cards iguales (para vender en tienda física) sin dedicatoria
 */
export function GiftCardsCreator() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [pending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      if (mode === 'single') {
        await createGiftCardAction(formData);
      } else {
        await bulkCreateGiftCardsAction(formData);
      }
    });
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setMode('single')}
          className={`text-sm px-3 py-1.5 rounded ${
            mode === 'single' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:bg-white/5'
          }`}>
          + Una card
        </button>
        <button type="button" onClick={() => setMode('bulk')}
          className={`text-sm px-3 py-1.5 rounded ${
            mode === 'bulk' ? 'bg-white text-black font-semibold' : 'text-white/60 hover:bg-white/5'
          }`}>
          + Bulk (varias iguales)
        </button>
      </div>

      <form action={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-1">
          <label className="block text-xs text-white/60 mb-1">Monto (en centavos)</label>
          <input type="number" name="amount_cents" required min={1} placeholder="1000000"
            className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          <p className="text-[10px] text-white/40 mt-0.5">Ej: 1000000 = $10.000</p>
        </div>

        <div className="md:col-span-1">
          <label className="block text-xs text-white/60 mb-1">
            {mode === 'bulk' ? 'Cantidad' : 'Válida por (días, opc)'}
          </label>
          {mode === 'bulk' ? (
            <input type="number" name="count" required min={1} max={200} defaultValue={20}
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          ) : (
            <input type="number" name="expires_days" min={0} placeholder="365 (o vacío = sin vencimiento)"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          )}
        </div>

        {mode === 'single' ? (
          <>
            <div className="md:col-span-1">
              <label className="block text-xs text-white/60 mb-1">Para (opc)</label>
              <input name="recipient_name" placeholder="Nombre del destinatario"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs text-white/60 mb-1">De (opc)</label>
              <input name="sender_name" placeholder="Nombre del que la regala"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs text-white/60 mb-1">Mensaje (opc)</label>
              <input name="message" placeholder="¡Feliz cumple, disfrutalo mucho!"
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
            </div>
          </>
        ) : (
          <div className="md:col-span-2">
            <label className="block text-xs text-white/60 mb-1">Válidas por (días, opc)</label>
            <input type="number" name="expires_days" min={0} placeholder="365"
              className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
        )}

        <div className="md:col-span-4">
          <button type="submit" disabled={pending}
            className="rounded bg-white text-black px-5 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-50">
            {pending ? 'Creando…' : mode === 'bulk' ? 'Crear cards' : 'Crear card'}
          </button>
        </div>
      </form>
    </div>
  );
}
