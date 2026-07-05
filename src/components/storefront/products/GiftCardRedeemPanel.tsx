'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY_PREFIX = 'curplat_giftcard_';

function storageKey(tenantId: string): string {
  return `${STORAGE_KEY_PREFIX}${tenantId}`;
}

type Saved = {
  code: string;
  amount_cents: number;
  currency: string;
  savedAt: number;
};

/**
 * Panel de canje. El destinatario tocca "Guardar" y quedamos con la card
 * en localStorage. Al ir al checkout, PhysicalCheckout la levanta y aplica
 * como descuento — quedando redeemed cuando el pago se confirma.
 */
export function GiftCardRedeemPanel({
  tenantId, code, amountCents, currency, tenantName
}: {
  tenantId: string;
  code: string;
  amountCents: number;
  currency: string;
  tenantName: string;
}) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(tenantId));
      if (raw) {
        const parsed = JSON.parse(raw) as Saved;
        if (parsed?.code === code) setSaved(parsed);
      }
    } catch { /* ignore */ }
  }, [tenantId, code]);

  function save() {
    const payload: Saved = { code, amount_cents: amountCents, currency, savedAt: Date.now() };
    try {
      localStorage.setItem(storageKey(tenantId), JSON.stringify(payload));
      setSaved(payload);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch { /* ignore private mode */ }
  }

  function remove() {
    localStorage.removeItem(storageKey(tenantId));
    setSaved(null);
  }

  return (
    <div className="mt-6 space-y-3">
      {saved ? (
        <div className="rounded-lg bg-white border border-emerald-300 p-4 text-center">
          <div className="text-emerald-700 font-semibold mb-1">
            {justSaved ? '✓ Guardada' : '✓ Ya está guardada'}
          </div>
          <p className="text-xs text-black/60">
            En tu próxima compra en <strong>{tenantName}</strong> se aplica automáticamente.
          </p>
          <div className="mt-3 flex gap-2 justify-center">
            <a href="/tienda"
              className="rounded bg-black text-white px-4 py-2 text-sm font-semibold hover:bg-black/85">
              Ir a la tienda →
            </a>
            <button type="button" onClick={remove}
              className="rounded border border-black/15 px-4 py-2 text-sm text-black/60 hover:bg-black/[0.03]">
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={save}
          className="w-full rounded-lg bg-emerald-600 text-white py-3.5 font-semibold hover:bg-emerald-700 transition">
          🎁 Guardar para mi próxima compra
        </button>
      )}
      <p className="text-[11px] text-black/50 text-center">
        La card se guarda en este dispositivo. Se aplica automáticamente al llegar al checkout.
      </p>
    </div>
  );
}
