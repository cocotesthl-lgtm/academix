'use client';

import { useState } from 'react';

export function CouponInput({
  courseId,
  priceCents,
  currency,
  primary,
  freeLabel = 'Inscribirme gratis',
  buyLabel = 'Comprar curso'
}: {
  courseId: string;
  priceCents: number;
  currency: string;
  primary: string;
  freeLabel?: string;
  buyLabel?: string;
}) {
  const [show, setShow] = useState(false);
  const [code, setCode] = useState('');

  return (
    <form action={`/api/checkout/${courseId}`} method="post" className="space-y-3">
      {priceCents > 0 ? (
        <button type="submit"
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}>
          {buyLabel} · ${(priceCents / 100).toLocaleString('es-AR')} {currency}
        </button>
      ) : (
        <button type="submit"
          className="w-full rounded-md py-3 font-semibold text-white"
          style={{ background: primary }}>
          {freeLabel}
        </button>
      )}

      {!show ? (
        <button type="button" onClick={() => setShow(true)} className="w-full text-xs text-black/50 hover:text-black/80 underline">
          ¿Tenés un código de descuento?
        </button>
      ) : (
        <div className="flex gap-2">
          <input
            name="coupon"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CÓDIGO"
            className="flex-1 rounded-md border border-black/15 px-3 py-2 text-sm font-mono uppercase"
          />
          <button type="button" onClick={() => { setShow(false); setCode(''); }} className="text-xs text-black/40 hover:text-black/60">
            ✕
          </button>
        </div>
      )}
    </form>
  );
}
