'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Botón "Pagar con PayPal" — Smart Buttons.
 *
 * Carga el SDK de PayPal usando el client_id del tenant y renderiza el
 * botón oficial. Al aprobar el pago, llama a nuestra ruta de captura.
 *
 * Props:
 *   - tenantId + courseId: para llamar a los endpoints
 *   - clientId: el Client ID de la app PayPal del OWNER (se lo pasa el
 *     server component padre desde integrations table)
 *   - sandbox: si carga la version sandbox del SDK
 *   - currency: ISO 4217 (USD/EUR/BRL/etc). Debe coincidir con el precio.
 *   - onSuccess: callback opcional cuando la captura termina OK
 */
declare global {
  interface Window {
    paypal?: {
      Buttons: (config: unknown) => { render: (selector: string | HTMLElement) => Promise<void> };
    };
  }
}

type Props = {
  tenantId: string;
  courseId: string;
  clientId: string;
  sandbox: boolean;
  currency: string;
  onSuccess?: (saleId: string | null) => void;
};

let sdkLoadedByClientId = new Map<string, Promise<void>>();

function loadPayPalSdk(clientId: string, currency: string): Promise<void> {
  const key = `${clientId}-${currency}`;
  const existing = sdkLoadedByClientId.get(key);
  if (existing) return existing;

  const p = new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no_window'));
    if (window.paypal?.Buttons) return resolve();
    const script = document.createElement('script');
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(currency)}&intent=capture`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('sdk_load_failed'));
    document.head.appendChild(script);
  });
  sdkLoadedByClientId.set(key, p);
  return p;
}

export function PayPalCheckoutButton({
  tenantId, courseId, clientId, sandbox, currency, onSuccess
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'paying' | 'done'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        await loadPayPalSdk(clientId, currency);
        if (cancelled || !window.paypal?.Buttons || !containerRef.current) return;
        containerRef.current.innerHTML = ''; // clean re-render
        setStatus('ready');
        await window.paypal.Buttons({
          style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
          createOrder: async () => {
            setError(null);
            setStatus('paying');
            const res = await fetch(`/api/paypal/${tenantId}/create-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ course_id: courseId })
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: 'create_failed' }));
              throw new Error(err.error || 'create_failed');
            }
            const data = await res.json();
            return data.order_id;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch(`/api/paypal/${tenantId}/capture-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: data.orderID, course_id: courseId })
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({ error: 'capture_failed' }));
              setError(err.error || 'capture_failed');
              setStatus('ready');
              return;
            }
            const done = await res.json();
            setStatus('done');
            onSuccess?.(done.sale_id ?? null);
            // Redirect al "mi-cuenta" o mostrar success inline
            if (typeof window !== 'undefined') {
              window.location.href = '/mi-cuenta?paypal=1';
            }
          },
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'paypal_error';
            setError(msg);
            setStatus('ready');
          },
          onCancel: () => {
            setStatus('ready');
          }
        }).render(containerRef.current);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'init_failed');
        setStatus('idle');
      }
    }
    init();
    return () => { cancelled = true; };
  }, [tenantId, courseId, clientId, currency, onSuccess]);

  return (
    <div className="space-y-2">
      {sandbox && (
        <div className="text-[10px] text-center text-amber-300 font-semibold uppercase tracking-wider">
          Modo sandbox — pagos de prueba
        </div>
      )}
      {status === 'loading' && (
        <div className="text-xs text-center text-white/50 py-3">Cargando PayPal…</div>
      )}
      <div ref={containerRef} />
      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-100">
          ❌ {error}
        </div>
      )}
    </div>
  );
}
