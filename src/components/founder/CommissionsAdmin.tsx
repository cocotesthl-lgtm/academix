'use client';

import { useActionState, useState, useTransition } from 'react';
import { setGlobalRateAction, setTenantOverrideAction, type CommissionResult } from '@/lib/commissions/actions';

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  commission_rate_override: number | null;
};

export function GlobalRateForm({ currentRate }: { currentRate: number }) {
  const [state, action, pending] = useActionState<CommissionResult | null, FormData>(
    setGlobalRateAction,
    null
  );
  return (
    <form action={action} className="rounded-xl border border-white/10 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Tasa global por defecto</h2>
        <p className="text-sm text-white/60 mt-1">
          Se aplica a todos los sitios que no tengan override propio. Actual:
          <span className="font-mono text-white ml-1">{(currentRate * 100).toFixed(2)}%</span>
        </p>
      </div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1">Nueva tasa (%)</label>
          <input
            name="rate_pct"
            type="number"
            step="0.01"
            min="0"
            max="100"
            required
            defaultValue={(currentRate * 100).toFixed(2)}
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-white/50 mb-1">Motivo</label>
          <input
            name="reason"
            required
            placeholder="Ajuste de pricing"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
          />
        </div>
        <button
          disabled={pending}
          className="rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90 disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Aplicar'}
        </button>
      </div>
      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2">
          Tasa actualizada. Aplica a ventas nuevas desde ahora.
        </div>
      )}
    </form>
  );
}

export function TenantOverridesTable({ tenants, globalRate }: { tenants: TenantRow[]; globalRate: number }) {
  return (
    <div className="rounded-xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
          <tr>
            <th className="text-left px-4 py-2.5">Sitio</th>
            <th className="text-left px-4 py-2.5">Tasa efectiva</th>
            <th className="text-left px-4 py-2.5">Override</th>
            <th className="text-right px-4 py-2.5">Motivo + guardar</th>
          </tr>
        </thead>
        <tbody>
          {tenants.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-6 text-center text-white/40">Sin sitios.</td></tr>
          )}
          {tenants.map((t) => (
            <OverrideRow key={t.id} tenant={t} globalRate={globalRate} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverrideRow({ tenant, globalRate }: { tenant: TenantRow; globalRate: number }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ratePct, setRatePct] = useState<string>(
    tenant.commission_rate_override !== null ? (tenant.commission_rate_override * 100).toFixed(2) : ''
  );
  const [reason, setReason] = useState('');

  const effective = tenant.commission_rate_override ?? globalRate;

  return (
    <tr className="border-t border-white/5">
      <td className="px-4 py-3">
        <div className="font-medium">{tenant.name}</div>
        <div className="text-xs text-white/40">{tenant.slug}</div>
      </td>
      <td className="px-4 py-3 font-mono">
        {(effective * 100).toFixed(2)}%
        {tenant.commission_rate_override === null && (
          <span className="text-xs text-white/40 ml-2">(global)</span>
        )}
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          step="0.01"
          min="0"
          max="100"
          placeholder="vacío = global"
          value={ratePct}
          onChange={(e) => setRatePct(e.target.value)}
          className="w-24 rounded bg-white/5 border border-white/15 px-2 py-1 focus:outline-none focus:border-white/40"
        />
        <span className="text-white/40 ml-1">%</span>
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex gap-2 justify-end">
          <input
            type="text"
            placeholder="motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded bg-white/5 border border-white/15 px-2 py-1 focus:outline-none focus:border-white/40 text-xs"
          />
          <button
            disabled={pending || !reason}
            onClick={() => {
              setMsg(null);
              start(async () => {
                const fd = new FormData();
                fd.set('tenant_id', tenant.id);
                fd.set('rate_pct', ratePct);
                fd.set('reason', reason);
                const res = await setTenantOverrideAction(fd);
                if (res.ok) {
                  setMsg({ ok: true, text: 'Guardado' });
                  setReason('');
                } else {
                  setMsg({ ok: false, text: res.error });
                }
              });
            }}
            className="rounded bg-white text-black px-3 py-1 text-xs font-medium hover:bg-white/90 disabled:opacity-50"
          >
            {pending ? '…' : 'Guardar'}
          </button>
        </div>
        {msg && (
          <div className={`text-xs mt-1 ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
            {msg.text}
          </div>
        )}
      </td>
    </tr>
  );
}
