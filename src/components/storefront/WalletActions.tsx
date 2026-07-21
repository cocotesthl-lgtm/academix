'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { transferWalletAction, requestWithdrawalAction } from '@/lib/wallets/actions';

/** Forms cliente: transferir saldo a otro user + solicitar retiro. */
export function WalletActions({
  tenantId, balanceCents, currency, transfersEnabled, withdrawalsEnabled, primary
}: {
  tenantId: string;
  balanceCents: number;
  currency: string;
  transfersEnabled: boolean;
  withdrawalsEnabled: boolean;
  primary: string;
}) {
  const [mode, setMode] = useState<null | 'transfer' | 'withdraw'>(null);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();

  if (!transfersEnabled && !withdrawalsEnabled) return null;

  function handleTransfer(fd: FormData) {
    setMsg(null);
    fd.set('tenant_id', tenantId);
    start(async () => {
      const r = await transferWalletAction(fd);
      if (r.ok) {
        setMsg({ kind: 'ok', text: r.message ?? 'Transferido OK.' });
        setMode(null);
        router.refresh();
      } else {
        setMsg({ kind: 'err', text: r.error });
      }
    });
  }

  function handleWithdraw(fd: FormData) {
    setMsg(null);
    fd.set('tenant_id', tenantId);
    start(async () => {
      const r = await requestWithdrawalAction(fd);
      if (r.ok) {
        setMsg({ kind: 'ok', text: r.message ?? 'Solicitud enviada.' });
        setMode(null);
        router.refresh();
      } else {
        setMsg({ kind: 'err', text: r.error });
      }
    });
  }

  return (
    <div className="space-y-2">
      {/* Botones para abrir cada flujo */}
      {!mode && (
        <div className="grid grid-cols-2 gap-2">
          {transfersEnabled && (
            <button type="button" onClick={() => { setMode('transfer'); setMsg(null); }}
              disabled={balanceCents <= 0}
              className="rounded-md py-2.5 text-sm font-semibold border-2 hover:bg-black/[0.04] transition disabled:opacity-40"
              style={{ borderColor: primary, color: primary }}>
              ↗ Transferir
            </button>
          )}
          {withdrawalsEnabled && (
            <button type="button" onClick={() => { setMode('withdraw'); setMsg(null); }}
              disabled={balanceCents <= 0}
              className="rounded-md py-2.5 text-sm font-semibold border-2 hover:bg-black/[0.04] transition disabled:opacity-40"
              style={{ borderColor: primary, color: primary }}>
              💸 Retirar
            </button>
          )}
        </div>
      )}

      {msg && (
        <div className={`rounded-md px-3 py-2 text-xs ${msg.kind === 'ok' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Form transferencia */}
      {mode === 'transfer' && (
        <form action={handleTransfer} className="rounded-lg border border-black/15 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">↗ Transferir saldo</div>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-black/45 hover:text-black">✕</button>
          </div>
          <label className="block">
            <span className="text-xs text-black/55">Email del destinatario</span>
            <input name="recipient_email" type="email" required placeholder="amigo@ejemplo.com"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-black/55">Monto ({currency})</span>
            <input name="amount" type="number" step="1" min={1} max={balanceCents / 100} required
              placeholder="0"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block">
            <span className="text-xs text-black/55">Mensaje <span className="text-black/35">(opcional)</span></span>
            <input name="note" maxLength={300} placeholder="Por las pizzas del finde"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={pending}
            className="w-full rounded py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `var(--brand-bg, ${primary})` }}>
            {pending ? 'Enviando…' : 'Transferir'}
          </button>
        </form>
      )}

      {/* Form retiro */}
      {mode === 'withdraw' && (
        <form action={handleWithdraw} className="rounded-lg border border-black/15 p-4 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">💸 Solicitar retiro</div>
            <button type="button" onClick={() => setMode(null)} className="text-xs text-black/45 hover:text-black">✕</button>
          </div>
          <p className="text-[11px] text-black/55">
            El sitio recibe tu solicitud y procesa el pago manualmente. Tu saldo se descuenta al solicitar;
            si la rechazan, se te devuelve.
          </p>
          <label className="block">
            <span className="text-xs text-black/55">Monto ({currency})</span>
            <input name="amount" type="number" step="1" min={1} max={balanceCents / 100} required
              placeholder="0"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm font-mono" />
          </label>
          <label className="block">
            <span className="text-xs text-black/55">Método (cómo querés recibirlo)</span>
            <input name="method" maxLength={50} placeholder="Transferencia bancaria, MercadoPago, efectivo…"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-black/55">Destino (CBU/alias/email/etc)</span>
            <input name="destination" maxLength={300} placeholder="0000003100001234567890 / juan.alias"
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm font-mono text-xs" />
          </label>
          <label className="block">
            <span className="text-xs text-black/55">Nota <span className="text-black/35">(opcional)</span></span>
            <input name="note" maxLength={500} placeholder=""
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={pending}
            className="w-full rounded py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: `var(--brand-bg, ${primary})` }}>
            {pending ? 'Enviando…' : 'Solicitar retiro'}
          </button>
        </form>
      )}
    </div>
  );
}
