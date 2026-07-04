'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setOrderStatusAction } from '@/lib/orders/actions';

type Status = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

const NEXT_STATUS: Partial<Record<Status, Status>> = {
  paid: 'preparing',
  preparing: 'shipped',
  shipped: 'delivered'
};

const NEXT_LABEL: Partial<Record<Status, string>> = {
  paid: 'Marcar como preparando',
  preparing: 'Marcar como enviada',
  shipped: 'Marcar como entregada'
};

const STATUS_LABEL: Record<Status, string> = {
  pending:    'Pendiente de pago',
  paid:       'Pagada',
  preparing:  'Preparando envío',
  shipped:    'Enviada',
  delivered:  'Entregada',
  cancelled:  'Cancelada',
  refunded:   'Reembolsada'
};

export function OrderStatusBox({
  orderId, status, paidAt, shippedAt, deliveredAt, paymentId
}: {
  orderId: string;
  status: Status;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  paymentId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function advance() {
    const next = NEXT_STATUS[status];
    if (!next) return;
    startTransition(async () => {
      await setOrderStatusAction(orderId, next);
      router.refresh();
    });
  }

  function cancel() {
    if (!confirm('¿Cancelar esta orden? El stock NO se repone automáticamente — hacé un ajuste manual si corresponde.')) return;
    startTransition(async () => {
      await setOrderStatusAction(orderId, 'cancelled');
      router.refresh();
    });
  }

  const nextLabel = NEXT_LABEL[status];

  return (
    <div className="sticky top-4 rounded-xl border border-white/10 p-4 space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-white/45 font-semibold mb-1">Estado</div>
        <div className="text-lg font-bold">{STATUS_LABEL[status]}</div>
      </div>

      <div className="space-y-1.5 text-xs text-white/60">
        {paidAt && <div>✓ Pagada · {new Date(paidAt).toLocaleString('es-AR')}</div>}
        {shippedAt && <div>📦 Enviada · {new Date(shippedAt).toLocaleString('es-AR')}</div>}
        {deliveredAt && <div>🎉 Entregada · {new Date(deliveredAt).toLocaleString('es-AR')}</div>}
      </div>

      {paymentId && (
        <div className="text-[10px] text-white/40 font-mono border-t border-white/5 pt-2">
          MP: {paymentId}
        </div>
      )}

      {nextLabel && (
        <button type="button" onClick={advance} disabled={pending}
          className="w-full py-2 rounded bg-white text-black text-sm font-semibold hover:bg-white/90 disabled:opacity-50">
          {pending ? 'Actualizando…' : nextLabel}
        </button>
      )}

      {status !== 'cancelled' && status !== 'refunded' && status !== 'delivered' && (
        <button type="button" onClick={cancel} disabled={pending}
          className="w-full py-1.5 rounded border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10 disabled:opacity-50">
          Cancelar orden
        </button>
      )}
    </div>
  );
}
