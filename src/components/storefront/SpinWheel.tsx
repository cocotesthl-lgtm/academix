'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { spinWheelAction } from '@/lib/coupons/actions';

type Prize = { id: string; label: string; type: 'percent' | 'fixed'; amount: number; weight: number };

export function SpinWheel({
  tenantId,
  title,
  subtitle,
  trigger,
  delaySeconds,
  buttonLabel,
  prizes,
  primary
}: {
  tenantId: string;
  title: string;
  subtitle: string;
  trigger: 'delay' | 'button' | 'exit';
  delaySeconds: number;
  buttonLabel: string;
  prizes: Prize[];
  primary: string;
}) {
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [pending, start] = useTransition();
  const [resultCode, setResultCode] = useState<string | null>(null);
  const [shownOnce, setShownOnce] = useState(false);
  const exitArmed = useRef(false);

  // Auto-open by trigger
  useEffect(() => {
    if (prizes.length === 0 || shownOnce) return;
    // Don't re-open in same session
    try {
      if (sessionStorage.getItem(`wheel-shown-${tenantId}`)) {
        setShownOnce(true);
        return;
      }
    } catch { /* ignore */ }

    if (trigger === 'delay') {
      const t = setTimeout(() => {
        setOpen(true);
        markShown();
      }, Math.max(0, delaySeconds * 1000));
      return () => clearTimeout(t);
    }
    if (trigger === 'exit') {
      const onLeave = (e: MouseEvent) => {
        if (e.clientY <= 0 && !exitArmed.current) {
          exitArmed.current = true;
          setOpen(true);
          markShown();
        }
      };
      document.addEventListener('mouseleave', onLeave);
      return () => document.removeEventListener('mouseleave', onLeave);
    }
    // 'button' trigger: do nothing automatic
  }, [trigger, delaySeconds, prizes.length, tenantId, shownOnce]);

  function markShown() {
    setShownOnce(true);
    try { sessionStorage.setItem(`wheel-shown-${tenantId}`, '1'); } catch { /* ignore */ }
  }

  function spin() {
    if (spinning || prizes.length === 0) return;
    setSpinning(true);
    const turns = 5 + Math.random() * 3;
    setAngle((a) => a + turns * 360);
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId);
      const res = await spinWheelAction(fd);
      // Sync end of animation with result reveal
      setTimeout(() => {
        setSpinning(false);
        if (res.ok && res.code) setResultCode(res.code);
        else setResultCode('ERROR');
      }, 3600);
    });
  }

  function copyCode() {
    if (!resultCode || resultCode === 'ERROR') return;
    try { navigator.clipboard.writeText(resultCode); } catch { /* ignore */ }
  }

  if (prizes.length === 0) return null;

  const slice = 360 / prizes.length;

  return (
    <>
      {trigger === 'button' && !open && (
        <button
          onClick={() => { setOpen(true); markShown(); }}
          className="fixed bottom-6 right-6 z-40 rounded-full shadow-lg px-5 py-3 text-sm font-semibold text-white animate-pulse hover:animate-none"
          style={{ background: primary }}
        >
          {buttonLabel || '🎰 Probá tu suerte'}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="relative bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-black/60"
            >✕</button>

            {!resultCode ? (
              <>
                <h2 className="text-2xl font-bold">{title}</h2>
                {subtitle && <p className="text-sm text-black/60 mt-1">{subtitle}</p>}

                <div className="relative my-6 mx-auto" style={{ width: 280, height: 280 }}>
                  <div
                    className="w-full h-full rounded-full overflow-hidden border-4"
                    style={{
                      borderColor: primary,
                      transform: `rotate(${angle}deg)`,
                      transition: spinning ? 'transform 3.6s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                      background: `conic-gradient(${prizes.map((p, i) => {
                        const start = i * slice;
                        const end = (i + 1) * slice;
                        const color = i % 2 === 0 ? primary : `${primary}aa`;
                        return `${color} ${start}deg ${end}deg`;
                      }).join(', ')})`
                    }}
                  >
                    {prizes.map((p, i) => {
                      const a = i * slice + slice / 2;
                      return (
                        <div key={p.id}
                          className="absolute top-1/2 left-1/2 text-xs font-bold text-white whitespace-nowrap"
                          style={{ transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-85px)` }}>
                          {p.label}
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white border-4 flex items-center justify-center font-bold text-sm"
                    style={{ borderColor: primary, color: primary }}
                  >★</div>
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{ borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: `18px solid ${primary}` }}
                  />
                </div>

                <button
                  onClick={spin}
                  disabled={spinning || pending}
                  className="rounded-md px-6 py-3 font-semibold text-white disabled:opacity-50"
                  style={{ background: primary }}
                >
                  {spinning ? 'Girando…' : '🎰 GIRAR'}
                </button>
                <p className="text-xs text-black/40 mt-3">Una sola vuelta por visita.</p>
              </>
            ) : resultCode === 'ERROR' ? (
              <>
                <div className="text-5xl mb-3">😞</div>
                <h2 className="text-xl font-bold">Ups, algo falló</h2>
                <p className="text-sm text-black/60 mt-2">Intentá de nuevo más tarde.</p>
              </>
            ) : (
              <>
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-2xl font-bold">¡Felicitaciones!</h2>
                <p className="text-sm text-black/60 mt-2">Tu código de descuento es:</p>
                <div className="mt-4 flex items-center gap-2">
                  <code className="flex-1 rounded-md border-2 border-dashed bg-black/[0.03] px-4 py-3 font-mono text-lg font-bold"
                    style={{ borderColor: primary, color: primary }}>{resultCode}</code>
                  <button onClick={copyCode} className="rounded-md px-4 py-3 text-sm font-semibold text-white" style={{ background: primary }}>
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-black/40 mt-3">
                  Aplicalo en el checkout de cualquier curso. Válido por 24 horas.
                </p>
                <a href="#cursos" onClick={() => setOpen(false)} className="mt-4 inline-block rounded-md px-5 py-2 text-sm font-semibold text-white" style={{ background: primary }}>
                  Ver cursos →
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
