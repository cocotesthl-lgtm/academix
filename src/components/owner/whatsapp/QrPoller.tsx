'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fetchQrDataAction } from '@/lib/whatsapp/bot-actions';

/**
 * Poll del QR de Evolution API. Cada intervalMs pide el QR actual —
 * Evolution lo rota cada 20s, así que no podemos cachear ninguno.
 * Cuando el state pasa a 'open' hace router.refresh() para que la
 * server component re-renderice el estado "conectado".
 */
export function QrPoller({ intervalMs = 4000 }: { intervalMs?: number }) {
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<string>('loading');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const stoppedRef = useRef(false);

  useEffect(() => {
    stoppedRef.current = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      if (stoppedRef.current) return;
      try {
        const res = await fetchQrDataAction();
        if (stoppedRef.current) return;
        setState(res.state);
        if (res.qrBase64) setQr(res.qrBase64);
        if (res.state === 'open') {
          // Conectado — refrescamos la página server-side para mostrar el
          // estado "connected" persistido y cortamos el polling.
          stoppedRef.current = true;
          router.refresh();
          return;
        }
      } catch (e) {
        setError((e as Error).message);
      }
      timer = setTimeout(tick, intervalMs);
    }

    tick();
    return () => {
      stoppedRef.current = true;
      if (timer) clearTimeout(timer);
    };
  }, [intervalMs, router]);

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-red-700 bg-red-50 rounded">
        Error obteniendo QR: {error}
      </div>
    );
  }

  if (state === 'open') {
    return (
      <div className="text-center py-8 text-emerald-700">
        ✅ Conectado — refrescando...
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="text-center py-12 text-sm text-black/60">
        Generando QR... ({state})
      </div>
    );
  }

  // Evolution devuelve el QR ya como data URL (data:image/png;base64,...)
  // o a veces sólo el base64 puro. Manejamos ambos.
  const src = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="QR de WhatsApp"
        className="w-64 h-64 border-4 border-emerald-500 rounded-lg" />
      <div className="text-xs text-black/50">Estado: {state}</div>
    </div>
  );
}
