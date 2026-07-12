'use client';

import { useState, useTransition } from 'react';
import { connectPaypalAction } from '@/lib/paypal/actions';

/**
 * Form de conexión de PayPal. Cliente porque:
 *  - Necesita mostrar errores inline devueltos por el action (bad creds
 *    detectado en tiempo real por PayPal API)
 *  - El toggle sandbox debe reflejarse en la ayuda de la card
 *
 * Storage: connectPaypalAction guarda en integrations table.
 */
export function PaypalConnectForm() {
  const [sandbox, setSandbox] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    if (sandbox) formData.set('sandbox', 'true');
    startTransition(async () => {
      const res = await connectPaypalAction(formData);
      if (!res.ok) setError(res.error);
      // si ok=true, revalidatePath en el server re-renderiza y muestra el estado conectado
    });
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/45">Email cuenta business</label>
          <input name="business_email" type="email" required maxLength={200}
            placeholder="tu-cuenta@paypal.com"
            className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-white/45">Modo</label>
          <div className="mt-1 flex gap-1 bg-white/5 rounded border border-white/15 p-0.5">
            <button type="button" onClick={() => setSandbox(true)}
              className={`flex-1 text-xs py-1 rounded ${sandbox ? 'bg-amber-500/20 text-amber-200 font-semibold' : 'text-white/60'}`}>
              Sandbox (test)
            </button>
            <button type="button" onClick={() => setSandbox(false)}
              className={`flex-1 text-xs py-1 rounded ${!sandbox ? 'bg-blue-500/20 text-blue-200 font-semibold' : 'text-white/60'}`}>
              Live (real)
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/45">Client ID</label>
        <input name="client_id" required maxLength={200}
          placeholder="AaBbCc123…"
          className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-wider text-white/45">Client Secret</label>
        <input name="client_secret" required type="password" maxLength={200}
          placeholder="EJk…"
          className="mt-1 w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
        <p className="text-[10px] text-white/40 mt-1">
          Lo tratamos como secreto — solo el service-role de OfferNow lo puede leer, y solo para crear pagos en tu nombre.
        </p>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-white/50 hover:text-white">Webhook ID (opcional — para confirmación automática)</summary>
        <div className="mt-2">
          <input name="webhook_id" maxLength={100}
            placeholder="8P37..."
            className="w-full rounded bg-white/5 border border-white/15 px-2.5 py-1.5 text-sm font-mono" />
          <p className="text-[10px] text-white/40 mt-1">
            Se configura después en PayPal Developer → Webhooks. Sin esto, los pagos igual se procesan al momento del checkout.
          </p>
        </div>
      </details>

      {error && (
        <div className="rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-100">
          ❌ {error}
        </div>
      )}

      <button type="submit" disabled={pending}
        className="w-full rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 disabled:opacity-50">
        {pending ? 'Validando con PayPal…' : 'Conectar PayPal'}
      </button>
    </form>
  );
}
