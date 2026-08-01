'use client';

import { useEffect, useState } from 'react';

/**
 * Input compacto de color:
 *   [swatch cuadrado][texto hex editable][🎯 eyedropper]
 *
 * - Al escribir en el input de texto valida el hex antes de propagar
 *   (evita disparar onChange con valores inválidos).
 * - El eyedropper usa la API nativa `window.EyeDropper` (Chrome 95+/Edge).
 *   Si no está disponible, el botón se oculta silenciosamente.
 * - Cambios desde afuera (prop `value`) sincronizan el input local.
 */
export function HexInput({
  value,
  onChange,
  className = ''
}: {
  value: string;
  onChange: (hex: string) => void;
  className?: string;
}) {
  const [text, setText] = useState(value);
  const [hasEyeDropper, setHasEyeDropper] = useState(false);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      setHasEyeDropper(true);
    }
  }, []);

  function isValidHex(h: string): boolean {
    return /^#[0-9a-fA-F]{6}$/.test(h.trim());
  }

  function commit(next: string) {
    let v = next.trim();
    if (!v.startsWith('#')) v = '#' + v;
    if (isValidHex(v)) {
      onChange(v.toLowerCase());
    } else {
      // Reset visual al último válido
      setText(value);
    }
  }

  async function pickWithEyeDropper() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ED = (window as any).EyeDropper;
      const dropper = new ED();
      const result = await dropper.open();
      if (result?.sRGBHex && isValidHex(result.sRGBHex)) {
        setText(result.sRGBHex);
        onChange(result.sRGBHex.toLowerCase());
      }
    } catch {
      /* user canceled */
    }
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <input
        type="color"
        value={isValidHex(value) ? value : '#000000'}
        onChange={(e) => { setText(e.target.value); onChange(e.target.value); }}
        className="w-7 h-7 rounded border border-white/15 bg-transparent cursor-pointer shrink-0"
        aria-label="Color picker"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
        }}
        placeholder="#000000"
        maxLength={7}
        className="w-[74px] px-1.5 py-1 text-[11px] font-mono rounded border border-white/15 bg-white/5 text-white/85 focus:outline-none focus:border-white/40"
      />
      {hasEyeDropper && (
        <button
          type="button"
          onClick={pickWithEyeDropper}
          title="Elegir color de la pantalla (gotero)"
          className="text-[11px] px-1.5 py-1 rounded border border-white/15 hover:bg-white/10 text-white/70"
          aria-label="Eyedropper"
        >
          🎯
        </button>
      )}
    </div>
  );
}
