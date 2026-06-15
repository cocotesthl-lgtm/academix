'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { setSectionStyleFieldAction } from '@/lib/site/actions';

/**
 * Panel "🎨 Estilos" para cada sección — popover con todos los overrides
 * finos (acento, título color+peso, body color, tarjetas, fuente).
 *
 * Todos los campos son opcionales: vacío = usa el default de la sección /
 * brand del tenant. Auto-save con debounce 400ms (igual que ColorAutoSave).
 */

const FONT_OPTIONS = [
  { value: '',        label: 'Default (sans)' },
  { value: 'sans',    label: 'Sans (Inter)' },
  { value: 'serif',   label: 'Serif (Playfair)' },
  { value: 'display', label: 'Display (Bebas Neue)' },
  { value: 'mono',    label: 'Mono (JetBrains)' }
];

const WEIGHT_OPTIONS = [
  { value: '',           label: 'Default' },
  { value: 'normal',     label: 'Normal' },
  { value: 'medium',     label: 'Medium' },
  { value: 'semibold',   label: 'Semibold' },
  { value: 'bold',       label: 'Bold' },
  { value: 'extrabold',  label: 'Extra Bold' },
  { value: 'black',      label: 'Black (máximo)' }
];

type Styles = {
  title_color: string | null;
  body_color: string | null;
  accent_color: string | null;
  card_bg_color: string | null;
  card_border_color: string | null;
  font_family: string | null;
  title_weight: string | null;
  // Bg image
  bg_image_url?: string | null;
  bg_image_opacity?: number | null;
  bg_image_position?: string | null;
  // Effects
  text_effect?: string | null;
  // Botones
  button_bg_color?: string | null;
  button_text_color?: string | null;
  button_border_color?: string | null;
  button_glow?: boolean | null;
  button_hidden?: boolean | null;
};

const TEXT_EFFECT_OPTIONS = [
  { value: '',         label: 'Sin efecto' },
  { value: 'shadow',   label: 'Sombra suave' },
  { value: 'glow',     label: 'Brillo (glow)' },
  { value: 'neon',     label: 'Neón' },
  { value: 'outline',  label: 'Contorno' }
];

const BG_POSITION_OPTIONS = [
  { value: '',         label: 'Cubrir (cover)' },
  { value: 'contain',  label: 'Contener (contain)' },
  { value: 'repeat',   label: 'Patrón repetido' },
  { value: 'center',   label: 'Centrado sin repetir' }
];

export function SectionStyleEditor({
  sectionKey,
  initial
}: {
  sectionKey: string;
  initial: Styles;
}) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // Cierra el popover si se clickea afuera
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Cuenta cuántos overrides están activos para mostrar badge
  const activeCount = Object.values(initial).filter(Boolean).length;

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`text-xs px-2.5 py-1 rounded border whitespace-nowrap flex items-center gap-1.5 ${
          activeCount > 0
            ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200'
            : 'border-white/15 text-white/60 hover:bg-white/5'
        }`}
        title="Personalizar estilos de esta sección"
      >
        🎨 Estilos
        {activeCount > 0 && (
          <span className="bg-fuchsia-500 text-white rounded-full text-[9px] px-1.5 py-0.5 leading-none font-bold">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-30 w-80 rounded-xl border border-white/15 bg-[#111] shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-semibold text-sm">🎨 Estilos de la sección</h4>
            <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-sm">✕</button>
          </div>

          <StyleColorRow label="Acento (botones)" sectionKey={sectionKey} field="accent_color" initial={initial.accent_color} />
          <StyleColorRow label="Color del título" sectionKey={sectionKey} field="title_color" initial={initial.title_color} />
          <StyleSelectRow
            label="Peso del título"
            sectionKey={sectionKey} field="title_weight"
            initial={initial.title_weight} options={WEIGHT_OPTIONS}
          />
          <StyleColorRow label="Color del body / párrafos" sectionKey={sectionKey} field="body_color" initial={initial.body_color} />

          <div className="border-t border-white/10 pt-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Tarjetas internas</p>
            <StyleColorRow label="Fondo de tarjetas" sectionKey={sectionKey} field="card_bg_color" initial={initial.card_bg_color} />
            <StyleColorRow label="Borde de tarjetas" sectionKey={sectionKey} field="card_border_color" initial={initial.card_border_color} />
          </div>

          <div className="border-t border-white/10 pt-3">
            <StyleSelectRow
              label="Fuente"
              sectionKey={sectionKey} field="font_family"
              initial={initial.font_family} options={FONT_OPTIONS}
            />
          </div>

          {/* Background image + opacity */}
          <div className="border-t border-white/10 pt-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Imagen de fondo</p>
            <StyleTextRow
              label="URL imagen"
              sectionKey={sectionKey} field="bg_image_url"
              initial={initial.bg_image_url ?? null}
              placeholder="https://..."
            />
            <StyleRangeRow
              label="Opacidad"
              sectionKey={sectionKey} field="bg_image_opacity"
              initial={initial.bg_image_opacity ?? 1}
            />
            <StyleSelectRow
              label="Modo"
              sectionKey={sectionKey} field="bg_image_position"
              initial={initial.bg_image_position ?? null}
              options={BG_POSITION_OPTIONS}
            />
          </div>

          {/* Efectos de texto */}
          <div className="border-t border-white/10 pt-3">
            <StyleSelectRow
              label="Efecto en títulos"
              sectionKey={sectionKey} field="text_effect"
              initial={initial.text_effect ?? null}
              options={TEXT_EFFECT_OPTIONS}
            />
          </div>

          {/* Botones */}
          <div className="border-t border-white/10 pt-3 space-y-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Botones (CTA)</p>
            <StyleColorRow label="Fondo del botón" sectionKey={sectionKey} field="button_bg_color" initial={initial.button_bg_color ?? null} />
            <StyleColorRow label="Texto del botón" sectionKey={sectionKey} field="button_text_color" initial={initial.button_text_color ?? null} />
            <StyleColorRow label="Borde del botón" sectionKey={sectionKey} field="button_border_color" initial={initial.button_border_color ?? null} />
            <StyleToggleRow
              label="Efecto brillo (glow)"
              sectionKey={sectionKey} field="button_glow"
              initial={!!initial.button_glow}
            />
            <StyleToggleRow
              label="Ocultar botón"
              sectionKey={sectionKey} field="button_hidden"
              initial={!!initial.button_hidden}
            />
          </div>

          <p className="text-[10px] text-white/40 leading-snug pt-1">
            Dejá vacío para usar el default. Los cambios se guardan automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}

function StyleTextRow({
  label, sectionKey, field, initial, placeholder
}: {
  label: string; sectionKey: string; field: string;
  initial: string | null; placeholder?: string;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initial ?? ''), [initial]);
  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  function save(v: string) {
    setValue(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      start(async () => {
        const fd = new FormData();
        fd.set('section', sectionKey);
        fd.set('field', field);
        fd.set('value', v);
        await setSectionStyleFieldAction(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      });
    }, 600);
  }

  return (
    <div className="space-y-1">
      <label className="text-xs text-white/60 flex items-center justify-between">
        <span>{label}</span>
        {pending && <span className="text-[10px] text-white/40">…</span>}
        {saved && !pending && <span className="text-[10px] text-emerald-300">✓</span>}
      </label>
      <input
        type="url"
        value={value}
        onChange={(e) => save(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded bg-white/5 border border-white/15 px-2 py-1 text-xs focus:outline-none focus:border-white/40 font-mono"
      />
    </div>
  );
}

function StyleRangeRow({
  label, sectionKey, field, initial
}: {
  label: string; sectionKey: string; field: string; initial: number;
}) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initial), [initial]);
  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  function save(v: number) {
    setValue(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      start(async () => {
        const fd = new FormData();
        fd.set('section', sectionKey);
        fd.set('field', field);
        fd.set('value', String(v));
        await setSectionStyleFieldAction(fd);
      });
    }, 200);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-white/60 flex-1">{label}</label>
      <input
        type="range" min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => save(parseFloat(e.target.value))}
        className="w-24"
      />
      <span className="text-[10px] text-white/55 w-8 text-right tabular-nums">
        {pending ? '…' : `${Math.round(value * 100)}%`}
      </span>
    </div>
  );
}

function StyleToggleRow({
  label, sectionKey, field, initial
}: {
  label: string; sectionKey: string; field: string; initial: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => setValue(initial), [initial]);

  function toggle() {
    const next = !value;
    setValue(next);
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set('field', field);
      fd.set('value', next ? 'true' : '');
      await setSectionStyleFieldAction(fd);
    });
  }

  return (
    <label className="flex items-center gap-2 text-xs text-white/65 cursor-pointer">
      <input type="checkbox" checked={value} onChange={toggle} disabled={pending}
        className="rounded" />
      {label}
    </label>
  );
}

/* ─────────── Sub-componentes ─────────── */

function StyleColorRow({
  label, sectionKey, field, initial
}: {
  label: string;
  sectionKey: string;
  field: string;
  initial: string | null;
}) {
  const [value, setValue] = useState(initial ?? '#000000');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(initial ?? '#000000'), [initial]);
  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  function save(v: string) {
    setValue(v);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      start(async () => {
        const fd = new FormData();
        fd.set('section', sectionKey);
        fd.set('field', field);
        fd.set('value', v);
        await setSectionStyleFieldAction(fd);
        setSaved(true);
        setTimeout(() => setSaved(false), 1200);
      });
    }, 400);
  }

  function reset() {
    if (debRef.current) clearTimeout(debRef.current);
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set('field', field);
      fd.set('value', '');
      await setSectionStyleFieldAction(fd);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-white/60 flex-1">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => save(e.target.value)}
        className="w-7 h-7 rounded bg-transparent border border-white/15 cursor-pointer"
      />
      {pending && <span className="text-[10px] text-white/40 w-3">…</span>}
      {saved && !pending && <span className="text-[10px] text-emerald-300 w-3">✓</span>}
      {!pending && !saved && <span className="w-3" />}
      {initial && (
        <button
          type="button"
          onClick={reset}
          className="text-[10px] px-1.5 py-0.5 rounded border border-white/15 hover:bg-white/5 text-white/50"
          title="Quitar override"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function StyleSelectRow({
  label, sectionKey, field, initial, options
}: {
  label: string;
  sectionKey: string;
  field: string;
  initial: string | null;
  options: Array<{ value: string; label: string }>;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  useEffect(() => setValue(initial ?? ''), [initial]);

  function save(v: string) {
    setValue(v);
    start(async () => {
      const fd = new FormData();
      fd.set('section', sectionKey);
      fd.set('field', field);
      fd.set('value', v);
      await setSectionStyleFieldAction(fd);
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-white/60 flex-1">{label}</label>
      <select
        value={value}
        onChange={(e) => save(e.target.value)}
        disabled={pending}
        className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs focus:outline-none focus:border-white/40 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value || '_default'} value={o.value}>{o.label}</option>
        ))}
      </select>
      {pending && <span className="text-[10px] text-white/40">…</span>}
      {saved && !pending && <span className="text-[10px] text-emerald-300">✓</span>}
    </div>
  );
}
