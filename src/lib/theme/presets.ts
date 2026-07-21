/**
 * Presets de temas curados — colores sólidos y gradientes bonitos
 * para elegir de un click en cualquier color picker de la app.
 *
 * Cada preset trae:
 *   - id: slug único
 *   - name: nombre visible
 *   - primary: hex del color dominante (para brand color, botones)
 *   - gradient: string CSS opcional (para fondos de sección, headers)
 *   - category: para agrupar en la UI ('sólidos' | 'gradientes' | ...)
 *
 * La idea: al hacer click en un preset, el consumer decide qué usar
 * (para brand → primary; para bg de sección → gradient si existe,
 * sino primary).
 */

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  gradient?: string;
  category: 'sólidos' | 'gradientes' | 'oscuros' | 'pasteles';
};

export const THEME_PRESETS: ThemePreset[] = [
  // ── SÓLIDOS: colores puros y vibrantes ─────────────────────
  { id: 'orange',    name: 'Naranja',    primary: '#f97316', category: 'sólidos' },
  { id: 'red',       name: 'Rojo',       primary: '#dc2626', category: 'sólidos' },
  { id: 'pink',      name: 'Rosa',       primary: '#db2777', category: 'sólidos' },
  { id: 'purple',    name: 'Púrpura',    primary: '#7c3aed', category: 'sólidos' },
  { id: 'indigo',    name: 'Índigo',     primary: '#4f46e5', category: 'sólidos' },
  { id: 'blue',      name: 'Azul',       primary: '#2563eb', category: 'sólidos' },
  { id: 'cyan',      name: 'Cyan',       primary: '#0891b2', category: 'sólidos' },
  { id: 'teal',      name: 'Verde agua', primary: '#0d9488', category: 'sólidos' },
  { id: 'emerald',   name: 'Esmeralda',  primary: '#059669', category: 'sólidos' },
  { id: 'lime',      name: 'Lima',       primary: '#65a30d', category: 'sólidos' },
  { id: 'amber',     name: 'Ámbar',      primary: '#d97706', category: 'sólidos' },
  { id: 'stone',     name: 'Piedra',     primary: '#57534e', category: 'sólidos' },

  // ── PASTELES: colores suaves ──────────────────────────────
  { id: 'pastel-pink',    name: 'Rosé',       primary: '#f9a8d4', category: 'pasteles' },
  { id: 'pastel-mint',    name: 'Menta',      primary: '#86efac', category: 'pasteles' },
  { id: 'pastel-sky',     name: 'Cielo',      primary: '#93c5fd', category: 'pasteles' },
  { id: 'pastel-lavender',name: 'Lavanda',    primary: '#c4b5fd', category: 'pasteles' },
  { id: 'pastel-peach',   name: 'Durazno',    primary: '#fdba74', category: 'pasteles' },
  { id: 'pastel-butter',  name: 'Mantequilla',primary: '#fef08a', category: 'pasteles' },

  // ── OSCUROS: base para looks premium ──────────────────────
  { id: 'dark-slate',     name: 'Pizarra',    primary: '#1e293b', category: 'oscuros' },
  { id: 'dark-black',     name: 'Negro',      primary: '#0a0a0a', category: 'oscuros' },
  { id: 'dark-wine',      name: 'Vino',       primary: '#581c1c', category: 'oscuros' },
  { id: 'dark-forest',    name: 'Bosque',     primary: '#14532d', category: 'oscuros' },
  { id: 'dark-navy',      name: 'Marino',     primary: '#0c1e3d', category: 'oscuros' },
  { id: 'dark-plum',      name: 'Ciruela',    primary: '#3b0764', category: 'oscuros' },

  // ── GRADIENTES: para fondos de sección o hero ─────────────
  {
    id: 'grad-ocaso',      name: 'Ocaso',
    primary: '#ec4899',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-oceano',     name: 'Océano',
    primary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 50%, #3b82f6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-aurora',     name: 'Aurora',
    primary: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 50%, #8b5cf6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-fuego',      name: 'Fuego',
    primary: '#ef4444',
    gradient: 'linear-gradient(135deg, #fde047 0%, #f97316 50%, #dc2626 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-selva',      name: 'Selva',
    primary: '#059669',
    gradient: 'linear-gradient(135deg, #84cc16 0%, #22c55e 50%, #059669 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-lavanda',    name: 'Lavanda',
    primary: '#a855f7',
    gradient: 'linear-gradient(135deg, #f0abfc 0%, #c084fc 50%, #a855f7 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-cyberpunk',  name: 'Cyberpunk',
    primary: '#e879f9',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #e879f9 50%, #facc15 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-noche',      name: 'Noche',
    primary: '#1e1b4b',
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #4c1d95 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-menta',      name: 'Menta fresca',
    primary: '#14b8a6',
    gradient: 'linear-gradient(135deg, #a7f3d0 0%, #6ee7b7 50%, #14b8a6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-atardecer',  name: 'Atardecer',
    primary: '#f59e0b',
    gradient: 'linear-gradient(135deg, #fecaca 0%, #fdba74 50%, #f59e0b 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-oro',        name: 'Oro',
    primary: '#ca8a04',
    gradient: 'linear-gradient(135deg, #fef08a 0%, #eab308 50%, #a16207 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-hielo',      name: 'Hielo',
    primary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #e0f2fe 0%, #7dd3fc 50%, #0284c7 100%)',
    category: 'gradientes'
  }
];

/** Devuelve solo los presets de una categoría. */
export function presetsByCategory(cat: ThemePreset['category']): ThemePreset[] {
  return THEME_PRESETS.filter((p) => p.category === cat);
}

/** True si el string es un gradiente CSS (empieza con linear-/radial-/conic-gradient). */
export function isGradient(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^(linear|radial|conic)-gradient\(/i.test(value.trim());
}
