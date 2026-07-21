/**
 * Presets de temas curados — colores sólidos y gradientes bonitos
 * para elegir de un click en cualquier color picker de la app.
 *
 * Cada preset trae:
 *   - id: slug único
 *   - name: nombre visible
 *   - primary: hex del color dominante (para brand color, botones)
 *   - gradient: string CSS opcional (para fondos de sección, headers)
 *   - category: 'sólidos' | 'gradientes' (2 tabs — sólido o gradiente)
 *
 * La idea: al hacer click en un preset, el consumer decide qué usar
 * (para brand → primary; para bg de sección → gradient si existe,
 * sino primary). El input color RGB nativo cubre el caso "custom".
 */

export type ThemePreset = {
  id: string;
  name: string;
  primary: string;
  gradient?: string;
  category: 'sólidos' | 'gradientes';
};

export const THEME_PRESETS: ThemePreset[] = [
  // ── SÓLIDOS: 12 colores vibrantes ────────────────────────────
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
  { id: 'black',     name: 'Negro',      primary: '#0a0a0a', category: 'sólidos' },

  // ── GRADIENTES: 12 gradientes con alto contraste real ────────
  // Diseñados para que el degradé se NOTE. Cada uno mezcla tonos
  // suficientemente distintos como para que el usuario pueda ver
  // que es gradient y no un color plano.
  {
    id: 'grad-ocaso',      name: 'Ocaso',
    primary: '#ec4899',
    gradient: 'linear-gradient(135deg, #f97316 0%, #ec4899 50%, #8b5cf6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-oceano',     name: 'Océano',
    primary: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #22d3ee 0%, #0ea5e9 50%, #1e3a8a 100%)',
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
    gradient: 'linear-gradient(135deg, #a3e635 0%, #22c55e 50%, #065f46 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-rosa',       name: 'Rosa',
    primary: '#db2777',
    // Rediseñado con más contraste: rosa fuerte → magenta → púrpura oscuro
    gradient: 'linear-gradient(135deg, #f472b6 0%, #db2777 50%, #7e22ce 100%)',
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
    gradient: 'linear-gradient(135deg, #020617 0%, #4c1d95 50%, #db2777 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-menta',      name: 'Menta',
    primary: '#14b8a6',
    // Rediseñado: menta muy claro → verde agua → azul oscuro
    gradient: 'linear-gradient(135deg, #6ee7b7 0%, #14b8a6 50%, #0c4a6e 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-atardecer',  name: 'Atardecer',
    primary: '#f59e0b',
    // Rediseñado: coral → naranja → rojo oscuro
    gradient: 'linear-gradient(135deg, #fca5a5 0%, #f97316 50%, #991b1b 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-oro',        name: 'Oro',
    primary: '#ca8a04',
    // Rediseñado: amarillo brillante → oro → marrón oscuro
    gradient: 'linear-gradient(135deg, #fde047 0%, #d97706 50%, #78350f 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-cielo',      name: 'Cielo',
    primary: '#0284c7',
    // Rediseñado: celeste claro → cyan → índigo profundo
    gradient: 'linear-gradient(135deg, #7dd3fc 0%, #0284c7 50%, #312e81 100%)',
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
