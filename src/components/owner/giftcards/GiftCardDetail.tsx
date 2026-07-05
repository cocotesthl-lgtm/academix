'use client';

import { useEffect, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cancelGiftCardAction, deleteGiftCardAction, type GiftCard } from '@/lib/giftcards/actions';

function formatMoney(cents: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

/**
 * Detalle de una gift card con QR grande + botones de descarga PNG/SVG.
 * El QR se renderiza client-side con la lib `qrcode` (ya dependencia del proyecto).
 */
export function GiftCardDetail({
  card, publicUrl, tenantName
}: {
  card: GiftCard;
  publicUrl: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publicUrl) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const QR = ((await import('qrcode')).default) as any;
      // Canvas grande para el preview + para el download PNG
      if (canvasRef.current) {
        await QR.toCanvas(canvasRef.current, publicUrl, {
          width: 400,
          margin: 1,
          errorCorrectionLevel: 'H',  // alta corrección — sobrevive logos overlay
          color: { dark: '#000000', light: '#00000000' }  // transparente
        });
      }
      // SVG string para descarga vectorial
      if (svgContainerRef.current) {
        const svgStr = await QR.toString(publicUrl, {
          type: 'svg', margin: 1, errorCorrectionLevel: 'H',
          color: { dark: '#000000', light: '#00000000' }
        });
        svgContainerRef.current.innerHTML = svgStr;
      }
    })();
  }, [publicUrl]);

  function downloadPng() {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `giftcard-${card.code}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  }

  function downloadSvg() {
    const svg = svgContainerRef.current?.querySelector('svg');
    if (!svg) return;
    const src = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([src], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `giftcard-${card.code}.svg`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function copyUrl() {
    navigator.clipboard.writeText(publicUrl);
  }

  function handleCancel() {
    if (!confirm(`¿Cancelar gift card ${card.code}? El destinatario no la va a poder usar.`)) return;
    startTransition(async () => {
      await cancelGiftCardAction(card.id);
      router.refresh();
    });
  }

  function handleDelete() {
    if (!confirm(`¿Eliminar gift card ${card.code}? Esto la borra del sistema. Si ya fue impresa, quien la tenga NO va a poder usarla.`)) return;
    startTransition(async () => {
      await deleteGiftCardAction(card.id);
    });
  }

  const expired = card.expires_at && new Date(card.expires_at) < new Date();
  const isActive = card.status === 'active' && !expired;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* QR + acciones */}
      <div className="rounded-xl border border-white/10 p-6 space-y-4">
        <div className="rounded-lg bg-white p-4 mx-auto max-w-xs">
          <canvas ref={canvasRef} className="w-full h-auto" />
        </div>
        <div ref={svgContainerRef} className="hidden" />

        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={downloadPng}
            className="rounded bg-white text-black text-sm px-3 py-2 font-semibold hover:bg-white/90">
            ⬇ PNG (transparente)
          </button>
          <button type="button" onClick={downloadSvg}
            className="rounded border border-white/15 text-white/85 text-sm px-3 py-2 hover:bg-white/5">
            ⬇ SVG (vectorial)
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/45 mb-1">URL del QR</div>
          <div className="flex items-center gap-2">
            <input readOnly value={publicUrl}
              className="flex-1 rounded bg-white/5 border border-white/10 px-2 py-1.5 text-xs font-mono focus:outline-none" />
            <button type="button" onClick={copyUrl}
              className="text-xs rounded border border-white/15 px-2 py-1.5 text-white/70 hover:bg-white/5">
              Copiar
            </button>
          </div>
        </div>

        <p className="text-[11px] text-white/50">
          💡 Descargá el PNG (fondo transparente), abrilo en Canva y pegá el QR sobre tu diseño de gift card. El SVG es mejor si tu diseño es vectorial (Illustrator/Figma).
        </p>
      </div>

      {/* Info + estado */}
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 p-5">
          <div className="text-xs uppercase tracking-wider text-white/45 font-semibold mb-1">Código</div>
          <div className="text-3xl font-mono font-bold">{card.code}</div>
          <div className="mt-3 text-3xl font-bold">{formatMoney(card.amount_cents, card.currency)}</div>

          <div className="mt-4 space-y-2 text-sm">
            <StatusBadge status={card.status} expired={!!expired} />
            {card.recipient_name && (
              <div><span className="text-white/50">Para:</span> {card.recipient_name}</div>
            )}
            {card.sender_name && (
              <div><span className="text-white/50">De:</span> {card.sender_name}</div>
            )}
            {card.message && (
              <div className="mt-2 pt-2 border-t border-white/5">
                <div className="text-white/50 text-xs">Mensaje</div>
                <div className="italic">{card.message}</div>
              </div>
            )}
            {card.expires_at && (
              <div className={expired ? 'text-rose-300' : ''}>
                <span className="text-white/50">Válida hasta:</span> {new Date(card.expires_at).toLocaleDateString('es-AR')}
              </div>
            )}
            {card.status === 'redeemed' && (
              <div className="pt-2 border-t border-white/5">
                <div className="text-white/50 text-xs">Canjeada</div>
                <div>{card.redeemed_by_email ?? '—'}</div>
                {card.redeemed_at && (
                  <div className="text-[11px] text-white/45">{new Date(card.redeemed_at).toLocaleString('es-AR')}</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-4 space-y-2">
          <h3 className="text-sm font-semibold">Acciones</h3>
          {isActive && (
            <button type="button" onClick={handleCancel} disabled={pending}
              className="w-full rounded border border-amber-500/30 text-amber-300 px-3 py-2 text-sm hover:bg-amber-500/10 disabled:opacity-50">
              Cancelar (destinatario no puede usar)
            </button>
          )}
          <button type="button" onClick={handleDelete} disabled={pending}
            className="w-full rounded border border-red-500/30 text-red-300 px-3 py-2 text-sm hover:bg-red-500/10 disabled:opacity-50">
            Eliminar del sistema
          </button>
          <p className="text-[10px] text-white/40">
            Tenant emisor: <strong>{tenantName}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, expired }: { status: string; expired: boolean }) {
  const st = expired ? { label: '⚠️ Expirada', color: 'bg-white/10 text-white/50' }
    : status === 'active' ? { label: '✨ Activa', color: 'bg-emerald-500/15 text-emerald-300' }
    : status === 'redeemed' ? { label: '✓ Canjeada', color: 'bg-blue-500/15 text-blue-300' }
    : status === 'cancelled' ? { label: '× Cancelada', color: 'bg-rose-500/15 text-rose-300' }
    : { label: status, color: 'bg-white/10' };
  return (
    <span className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${st.color}`}>
      {st.label}
    </span>
  );
}
