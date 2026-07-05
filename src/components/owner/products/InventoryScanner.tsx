'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { adjustStockAction } from '@/lib/products/actions';

type Lookup =
  | {
      found: true;
      kind: 'product' | 'variant';
      product_id: string;
      variant_id: string | null;
      title: string;
      variant_label: string | null;
      sku: string;
      stock_qty: number;
      cover_url: string | null;
    }
  | { found: false; sku: string };

type LogEntry = {
  at: number;
  sku: string;
  ok: boolean;
  title?: string;
  variant_label?: string | null;
  delta?: number;
  newStock?: number;
  error?: string;
};

type Mode = 'add' | 'remove';

/**
 * Scanner de inventario. Escaneá con:
 *   1) Pistola USB — tipea el SKU + Enter (input siempre focused).
 *   2) Cámara del celular — usa html5-qrcode con formatos 1D + QR.
 *   3) Manual — tipeás el SKU y Enter.
 *
 * El modo (Sumar / Restar) determina el delta. Se aplica automáticamente
 * al lookup exitoso — sin confirm — porque el workflow real es escanear
 * 20 productos seguidos al recibir mercadería. Los errores se guardan en
 * el log para revisión.
 */
export function InventoryScanner({ tenantId }: { tenantId: string }) {
  const [mode, setMode] = useState<Mode>('add');
  const [delta, setDelta] = useState<number>(1);
  const [reason, setReason] = useState<'restock' | 'adjustment' | 'return' | 'damage'>('restock');
  const [code, setCode] = useState('');
  const [last, setLast] = useState<LogEntry | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCodeRef = useRef<{ code: string; at: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);

  // Auto-focus al input al cargar y cuando se cierra cámara.
  useEffect(() => {
    if (!cameraOn) inputRef.current?.focus();
  }, [cameraOn, last]);

  // Fallback global: si el usuario tipea (o la pistola dispara caracteres) y
  // el input no está focused (p.ej. clickeó una card del historial), forzamos
  // el focus para no perder el escaneo. Ignoramos si otro input/textarea/select
  // ya tiene focus.
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if (cameraOn) return;
      const tag = (document.activeElement?.tagName ?? '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      // Solo caracteres imprimibles o Enter (evita atajos con Ctrl/Alt/Meta)
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key.length === 1 || e.key === 'Enter') {
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, [cameraOn]);

  function beep(ok: boolean) {
    try {
      const ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = ok ? 1200 : 400;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, ok ? 120 : 250);
    } catch { /* browser sin AudioContext */ }
  }

  async function processScan(rawSku: string) {
    const sku = rawSku.trim();
    if (!sku) return;
    // Anti-doble-scan: si es el mismo código y llegó hace menos de 1.5s, ignoramos.
    const now = Date.now();
    if (lastCodeRef.current && lastCodeRef.current.code === sku && now - lastCodeRef.current.at < 1500) {
      return;
    }
    lastCodeRef.current = { code: sku, at: now };

    // Devolvemos focus al input inmediatamente — la operación es async pero
    // el operador ya puede pasar al siguiente escaneo (procesamos en orden).
    setTimeout(() => inputRef.current?.focus(), 0);

    start(async () => {
      // 1) Lookup
      const res = await fetch(`/api/inventory/lookup/${tenantId}?sku=${encodeURIComponent(sku)}`);
      const data = await res.json() as Lookup;
      if (!data.found) {
        const entry: LogEntry = { at: now, sku, ok: false, error: 'SKU no encontrado' };
        setLast(entry);
        setLog((prev) => [entry, ...prev].slice(0, 50));
        beep(false);
        setCode('');
        return;
      }

      // 2) Aplicar delta
      const signedDelta = mode === 'add' ? Math.abs(delta) : -Math.abs(delta);
      try {
        await adjustStockAction(
          data.product_id,
          data.variant_id,
          signedDelta,
          reason,
          `Scan SKU ${sku}`
        );
        const newStock = Math.max(0, data.stock_qty + signedDelta);
        const entry: LogEntry = {
          at: now, sku, ok: true,
          title: data.title,
          variant_label: data.variant_label,
          delta: signedDelta,
          newStock
        };
        setLast(entry);
        setLog((prev) => [entry, ...prev].slice(0, 50));
        beep(true);
        // Re-focus por si algo lo perdió durante el await
        inputRef.current?.focus();
      } catch (e) {
        const entry: LogEntry = {
          at: now, sku, ok: false,
          title: data.title, variant_label: data.variant_label,
          error: e instanceof Error ? e.message : 'error'
        };
        setLast(entry);
        setLog((prev) => [entry, ...prev].slice(0, 50));
        beep(false);
        inputRef.current?.focus();
      }
      setCode('');
    });
  }

  // Cámara: cargar html5-qrcode + scanner con formatos de barcode habilitados
  useEffect(() => {
    if (!cameraOn) {
      if (html5QrRef.current) {
        try { html5QrRef.current.stop(); } catch { /* ignore */ }
        html5QrRef.current = null;
      }
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mod = await import('html5-qrcode') as any;
        if (cancelled) return;
        const id = 'inventory-camera-region';
        const scanner = new mod.Html5Qrcode(id);
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: 250,
            // Habilitamos formatos 1D típicos de retail + QR
            formatsToSupport: mod.Html5QrcodeSupportedFormats ? [
              mod.Html5QrcodeSupportedFormats.QR_CODE,
              mod.Html5QrcodeSupportedFormats.EAN_13,
              mod.Html5QrcodeSupportedFormats.EAN_8,
              mod.Html5QrcodeSupportedFormats.UPC_A,
              mod.Html5QrcodeSupportedFormats.UPC_E,
              mod.Html5QrcodeSupportedFormats.CODE_128,
              mod.Html5QrcodeSupportedFormats.CODE_39,
              mod.Html5QrcodeSupportedFormats.CODE_93,
              mod.Html5QrcodeSupportedFormats.ITF
            ] : undefined
          },
          (decoded: string) => {
            processScan(decoded);
          },
          () => { /* silent frame errors */ }
        );
      } catch (e) {
        console.error('[inv-scan] camera error', e);
        setCameraOn(false);
        alert('No se pudo abrir la cámara. Permitís el acceso?');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, mode, delta, reason]);

  const isAdd = mode === 'add';

  return (
    <div className="space-y-4">
      {/* Config: modo + delta + razón */}
      <div className="rounded-xl border border-white/10 p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Modo</label>
            <div className="flex rounded-lg overflow-hidden border border-white/15">
              <button type="button" onClick={() => setMode('add')}
                className={`flex-1 py-2 text-sm font-semibold transition ${
                  isAdd ? 'bg-emerald-500/25 text-emerald-100' : 'text-white/60 hover:bg-white/5'
                }`}>
                ＋ Sumar
              </button>
              <button type="button" onClick={() => setMode('remove')}
                className={`flex-1 py-2 text-sm font-semibold transition ${
                  !isAdd ? 'bg-rose-500/25 text-rose-100' : 'text-white/60 hover:bg-white/5'
                }`}>
                − Restar
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">
              Por escaneo
            </label>
            <input type="number" min={1} value={delta}
              onChange={(e) => setDelta(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Razón</label>
            <select value={reason}
              onChange={(e) => setReason(e.target.value as typeof reason)}
              className="w-full rounded-lg bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40">
              <option value="restock">Reposición</option>
              <option value="adjustment">Ajuste manual</option>
              <option value="return">Devolución</option>
              <option value="damage">Rotura/Merma</option>
            </select>
          </div>
        </div>
      </div>

      {/* Input + cámara */}
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); processScan(code); } }}
            onBlur={(e) => {
              // Si el focus salió a un elemento que NO es interactivo (o a nada),
              // volvemos a enfocar el input. Los clicks en otros inputs (modo/razón)
              // llevan el focus a esos elementos legítimamente y no interferimos.
              const next = e.relatedTarget as HTMLElement | null;
              const tag = (next?.tagName ?? '').toLowerCase();
              if (!next || (tag !== 'input' && tag !== 'button' && tag !== 'select' && tag !== 'textarea')) {
                setTimeout(() => inputRef.current?.focus(), 0);
              }
            }}
            placeholder="Escaneá con pistola o tipeá el SKU y Enter…"
            className="flex-1 min-w-[220px] rounded-lg bg-black/40 border border-white/20 px-4 py-3 text-base font-mono tracking-wider focus:border-orange-400 outline-none"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
          />
          <button
            type="button"
            onClick={() => processScan(code)}
            disabled={pending || !code.trim()}
            className="rounded-lg bg-orange-500 text-white px-5 py-3 font-semibold hover:bg-orange-400 disabled:opacity-50"
          >
            Aplicar
          </button>
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            className={`rounded-lg px-4 py-3 font-medium border ${
              cameraOn
                ? 'bg-orange-500/20 border-orange-400 text-amber-100'
                : 'border-white/20 text-white/70 hover:bg-white/5'
            }`}
          >
            📷 {cameraOn ? 'Cerrar cámara' : 'Cámara'}
          </button>
        </div>
        <p className="text-[11px] text-white/45 mt-2">
          Cada escaneo aplica <strong>{isAdd ? '+' : '−'}{delta}</strong> al stock. Sin confirmación —
          escaneás varios en fila. Si te equivocás, cambiá el modo y volvé a escanear.
        </p>
      </div>

      {cameraOn && (
        <div className="rounded-xl border border-orange-500/30 bg-black p-3">
          <div id="inventory-camera-region" className="w-full max-w-md mx-auto" />
          <p className="text-center text-xs text-white/50 mt-2">
            Apuntá al código de barras del producto
          </p>
        </div>
      )}

      {/* Feedback grande del último escaneo */}
      {last && (
        <div className={`rounded-2xl border-2 p-6 ${
          last.ok
            ? isAdd ? 'bg-emerald-500/15 border-emerald-400' : 'bg-blue-500/15 border-blue-400'
            : 'bg-rose-500/15 border-rose-400'
        }`}>
          <div className="flex items-start gap-4">
            <div className={`text-5xl ${
              last.ok ? (isAdd ? 'text-emerald-300' : 'text-blue-300') : 'text-rose-300'
            }`}>
              {last.ok ? '✓' : '✗'}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-xl font-bold ${
                last.ok
                  ? (isAdd ? 'text-emerald-100' : 'text-blue-100')
                  : 'text-rose-100'
              }`}>
                {last.ok
                  ? `Stock ${last.delta && last.delta > 0 ? 'sumado' : 'restado'}`
                  : (last.error ?? 'Error')}
              </h3>
              {last.title && (
                <div className="mt-2 text-sm">
                  <div className="text-white/90 font-medium">
                    {last.title}
                    {last.variant_label && <span className="text-white/60"> · {last.variant_label}</span>}
                  </div>
                  <div className="text-[11px] text-white/50 font-mono mt-0.5">{last.sku}</div>
                </div>
              )}
              {last.ok && last.newStock !== undefined && last.delta !== undefined && (
                <div className="mt-3 text-3xl font-bold font-mono">
                  {last.newStock - last.delta} → {last.newStock}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      {log.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs uppercase tracking-wider text-white/45 mb-2">
            Últimos escaneos ({log.length})
          </h4>
          <ul className="space-y-1">
            {log.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                <span className={l.ok ? (l.delta && l.delta > 0 ? 'text-emerald-300' : 'text-blue-300') : 'text-rose-300'}>
                  {l.ok ? (l.delta && l.delta > 0 ? '＋' : '−') : '✗'}
                </span>
                <span className="font-mono text-white/70 w-32 truncate">{l.sku}</span>
                <span className="text-white/60 flex-1 truncate">
                  {l.title ? `${l.title}${l.variant_label ? ' · ' + l.variant_label : ''}` : l.error}
                </span>
                {l.ok && l.newStock !== undefined && (
                  <span className="text-white/80 font-mono">→ {l.newStock}</span>
                )}
                <span className="text-white/35 w-14 text-right">
                  {new Date(l.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
