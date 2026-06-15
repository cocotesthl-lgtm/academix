'use client';

import { useState, useEffect } from 'react';

/**
 * Dropdown smart para el campo href de un CTA.
 * Sugiere las secciones existentes (#cursos, #features, etc) y permite
 * tipear una URL custom o un path interno.
 *
 * Se usa dentro de los forms de las secciones en lugar de un input texto
 * plano. Cuando el owner elige una sección, se pone "#section_id" en el
 * input subyacente.
 */

const COMMON_TARGETS: Array<{ value: string; label: string; group: string }> = [
  // Secciones del storefront (anchor links)
  { value: '#hero',         label: '#hero', group: 'Secciones del sitio' },
  { value: '#about',        label: '#about (Sobre nosotros)', group: 'Secciones del sitio' },
  { value: '#features',     label: '#features (Beneficios)', group: 'Secciones del sitio' },
  { value: '#catalog',      label: '#catalog (Cursos)', group: 'Secciones del sitio' },
  { value: '#featured',     label: '#featured (Destacados)', group: 'Secciones del sitio' },
  { value: '#pricing',      label: '#pricing (Planes)', group: 'Secciones del sitio' },
  { value: '#testimonials', label: '#testimonials', group: 'Secciones del sitio' },
  { value: '#faq',          label: '#faq', group: 'Secciones del sitio' },
  { value: '#contact',      label: '#contact', group: 'Secciones del sitio' },
  { value: '#gallery',      label: '#gallery', group: 'Secciones del sitio' },
  { value: '#video',        label: '#video', group: 'Secciones del sitio' },
  { value: '#cta_final',    label: '#cta_final', group: 'Secciones del sitio' },
  // Páginas internas
  { value: '/buscar',       label: '/buscar (Marketplace)', group: 'Páginas internas' },
  { value: '/learn',        label: '/learn (Mis cursos)', group: 'Páginas internas' },
  { value: '/login',        label: '/login', group: 'Páginas internas' },
  { value: '/signup',       label: '/signup', group: 'Páginas internas' },
  { value: '/affiliate',    label: '/affiliate (Ser afiliado)', group: 'Páginas internas' }
];

/** Versión controlled — usada en los SectionEditors que ya manejan el estado. */
export function HrefField({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isCommon = COMMON_TARGETS.some((t) => t.value === value);
  const [mode, setMode] = useState<'common' | 'custom'>(isCommon || !value ? 'common' : 'custom');

  const grouped: Record<string, typeof COMMON_TARGETS> = {};
  for (const t of COMMON_TARGETS) {
    if (!grouped[t.group]) grouped[t.group] = [];
    grouped[t.group].push(t);
  }

  return (
    <label className="block space-y-1.5">
      <span className="block text-[10px] uppercase tracking-wider text-white/45">{label}</span>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('common')}
          className={`text-[10px] px-2 py-1 rounded ${
            mode === 'common' ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5'
          }`}
        >
          Sección
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`text-[10px] px-2 py-1 rounded ${
            mode === 'custom' ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5'
          }`}
        >
          URL custom
        </button>
      </div>
      {mode === 'common' ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
        >
          <option value="">— elegí destino —</option>
          {Object.entries(grouped).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://otro-sitio.com  o  /pagina-interna"
          className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono"
        />
      )}
    </label>
  );
}

export function HrefSelect({
  name,
  defaultValue,
  required = false,
  className = ''
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const initial = defaultValue ?? '';
  // Detectar si el initial está en COMMON_TARGETS
  const isCommon = COMMON_TARGETS.some((t) => t.value === initial);
  const [mode, setMode] = useState<'common' | 'custom'>(isCommon || !initial ? 'common' : 'custom');
  const [value, setValue] = useState(initial);

  useEffect(() => {
    // Si el value cambia desde afuera (poco común), sincronizar
    setValue(initial);
    setMode(COMMON_TARGETS.some((t) => t.value === initial) || !initial ? 'common' : 'custom');
  }, [initial]);

  // Agrupar opciones para el optgroup
  const grouped: Record<string, typeof COMMON_TARGETS> = {};
  for (const t of COMMON_TARGETS) {
    if (!grouped[t.group]) grouped[t.group] = [];
    grouped[t.group].push(t);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setMode('common')}
          className={`text-[10px] px-2 py-1 rounded ${
            mode === 'common' ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5'
          }`}
        >
          Sección del sitio
        </button>
        <button
          type="button"
          onClick={() => setMode('custom')}
          className={`text-[10px] px-2 py-1 rounded ${
            mode === 'custom' ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5'
          }`}
        >
          URL custom
        </button>
      </div>

      {mode === 'common' ? (
        <select
          name={name}
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm ${className}`}
        >
          <option value="">— elegí destino —</option>
          {Object.entries(grouped).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <input
          type="text"
          name={name}
          required={required}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://otro-sitio.com  o  /pagina-interna"
          className={`w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono ${className}`}
        />
      )}
    </div>
  );
}
