'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

/**
 * Scanner de tickets para el día del evento.
 *
 * Soporta 3 modos:
 *  1) Pistola física USB → la pistola "tipea" el código en el input y
 *     dispara Enter. El input está siempre focused.
 *  2) Manual: el owner tipea el order_number (6 chars) o lo lee al alumno.
 *  3) Cámara web (toggle): usa html5-qrcode (lib JS) dinámicamente
 *     importado para no inflar el bundle.
 *
 * El feedback es VISUAL Y GRANDE — verde = válido, rojo = inválido /
 * ya usado. Sound feedback opcional (beep nativo).
 */
type Ticket = {
  id: string;
  order_number: string | null;
  seat_label: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  course_title: string;
  event_date: string;
  validation_count: number;
};

type Result =
  | { ok: true; status: 're_entry' | 'first_use'; ticket: Ticket; previousAt?: string }
  | { ok: false; status: 'not_found' | 'wrong_tenant' | 'not_confirmed' | 'already_used' | 'unauthorized'; ticket?: Ticket; previousAt?: string };

type LogEntry = { code: string; at: number; result: Result };

export function TicketScanner() {
  const [code, setCode] = useState('');
  const [last, setLast] = useState<Result | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraDivRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrRef = useRef<any>(null);

  // Auto-focus al input al cargar y cuando se cierra cámara
  useEffect(() => {
    if (!cameraOn) inputRef.current?.focus();
  }, [cameraOn, last]);

  function beep(ok: boolean) {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = ok ? 1200 : 400;
      gain.gain.value = 0.1;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, ok ? 120 : 250);
    } catch { /* ignore — algun browser viejo */ }
  }

  function submit(rawCode: string) {
    const trimmed = rawCode.trim();
    if (!trimmed) return;
    start(async () => {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: trimmed })
      });
      const json = await res.json() as Result;
      setLast(json);
      setLog((prev) => [{ code: trimmed, at: Date.now(), result: json }, ...prev].slice(0, 50));
      beep(json.ok);
      setCode('');
    });
  }

  // Cámara: cargar lib + scanner
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
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const id = 'qr-camera-region';
        const scanner = new Html5Qrcode(id);
        html5QrRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          (decoded: string) => {
            // Evitar disparar muchas veces el mismo
            if (!pending) submit(decoded);
          },
          () => { /* ignore frame errors */ }
        );
      } catch (e) {
        console.error('[scanner] camera error', e);
        setCameraOn(false);
        alert('No se pudo abrir la cámara. Permitís el acceso?');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn]);

  const ok = last?.ok === true;
  const errorStatus = last && !last.ok ? last.status : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(code); } }}
            placeholder="Escaneá con la pistola o tipeá el N° de orden…"
            disabled={pending}
            className="flex-1 min-w-[200px] rounded-lg bg-black/40 border border-white/20 px-4 py-3 text-base font-mono tracking-wider focus:border-fuchsia-400 outline-none disabled:opacity-50"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
          />
          <button
            type="button"
            onClick={() => submit(code)}
            disabled={pending || !code.trim()}
            className="rounded-lg bg-fuchsia-500 text-white px-5 py-3 font-semibold hover:bg-fuchsia-400 disabled:opacity-50"
          >
            Validar
          </button>
          <button
            type="button"
            onClick={() => setCameraOn((v) => !v)}
            className={`rounded-lg px-4 py-3 font-medium border ${cameraOn ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-100' : 'border-white/20 text-white/70 hover:bg-white/5'}`}
          >
            📷 {cameraOn ? 'Cerrar cámara' : 'Cámara'}
          </button>
        </div>
        <p className="text-[11px] text-white/45">
          La pistola escanea y dispara Enter automático. Sin pistola, tipeá el código de 6 letras y Enter.
        </p>
      </div>

      {cameraOn && (
        <div className="rounded-xl border border-fuchsia-500/30 bg-black p-3">
          <div id="qr-camera-region" ref={cameraDivRef} className="w-full max-w-md mx-auto" />
          <p className="text-center text-xs text-white/50 mt-2">Apuntá al QR del ticket</p>
        </div>
      )}

      {/* Feedback grande del último escaneo */}
      {last && (
        <div className={`rounded-2xl border-2 p-6 ${ok ? 'bg-emerald-500/15 border-emerald-400' : 'bg-rose-500/15 border-rose-400'}`}>
          <div className="flex items-start gap-4">
            <div className={`text-5xl ${ok ? 'text-emerald-300' : 'text-rose-300'}`}>{ok ? '✓' : '✗'}</div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-2xl font-bold ${ok ? 'text-emerald-100' : 'text-rose-100'}`}>
                {ok && last.status === 'first_use' && 'Entrada validada'}
                {ok && last.status === 're_entry' && 'Re-entrada permitida'}
                {!ok && errorStatus === 'not_found' && 'Ticket no encontrado'}
                {!ok && errorStatus === 'wrong_tenant' && 'Ticket de otro tenant'}
                {!ok && errorStatus === 'not_confirmed' && 'Ticket no confirmado'}
                {!ok && errorStatus === 'already_used' && 'Ya usado'}
                {!ok && errorStatus === 'unauthorized' && 'No autorizado'}
              </h3>
              {last.ticket && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="text-white/55">Comprador</div>
                  <div className="font-medium">{last.ticket.buyer_name || last.ticket.buyer_email || '—'}</div>
                  {last.ticket.seat_label && (<>
                    <div className="text-white/55">Asiento</div>
                    <div className="font-mono font-semibold">{last.ticket.seat_label}</div>
                  </>)}
                  <div className="text-white/55">N° orden</div>
                  <div className="font-mono">{last.ticket.order_number}</div>
                  <div className="text-white/55">Evento</div>
                  <div>{last.ticket.course_title}</div>
                  {!ok && last.previousAt && (<>
                    <div className="text-white/55">Validado antes</div>
                    <div>{new Date(last.previousAt).toLocaleString('es-AR')}</div>
                  </>)}
                  {ok && last.status === 're_entry' && (
                    <>
                      <div className="text-white/55">Re-entrada N°</div>
                      <div>{last.ticket.validation_count}</div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historial */}
      {log.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <h4 className="text-xs uppercase tracking-wider text-white/45 mb-2">Últimos escaneos</h4>
          <ul className="space-y-1">
            {log.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-xs py-1 border-b border-white/5 last:border-0">
                <span className={l.result.ok ? 'text-emerald-300' : 'text-rose-300'}>
                  {l.result.ok ? '✓' : '✗'}
                </span>
                <span className="font-mono text-white/70 w-24 truncate">{l.code}</span>
                <span className="text-white/50 flex-1 truncate">
                  {l.result.ticket?.buyer_name || l.result.ticket?.buyer_email || '—'}
                  {l.result.ticket?.seat_label ? ` · ${l.result.ticket.seat_label}` : ''}
                </span>
                <span className="text-white/35">
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
