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
  },

  // ── Segundo lote: gradientes más elaborados ──────────────
  {
    id: 'grad-miami',      name: 'Miami',
    primary: '#ec4899',
    gradient: 'linear-gradient(135deg, #22d3ee 0%, #ec4899 50%, #f97316 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-tropical',   name: 'Tropical',
    primary: '#14b8a6',
    gradient: 'linear-gradient(135deg, #fef08a 0%, #22c55e 50%, #0891b2 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-berry',      name: 'Berry',
    primary: '#a21caf',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #a21caf 50%, #1e40af 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-purple-rain',name: 'Purple Rain',
    primary: '#a855f7',
    gradient: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-vintage',    name: 'Vintage',
    primary: '#a16207',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #a16207 50%, #7c2d12 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-neon',       name: 'Neón',
    primary: '#a3e635',
    gradient: 'linear-gradient(135deg, #a3e635 0%, #06b6d4 50%, #d946ef 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-northern',   name: 'Aurora Boreal',
    primary: '#22d3ee',
    gradient: 'linear-gradient(135deg, #4ade80 0%, #22d3ee 50%, #a855f7 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-cosmic',     name: 'Cósmico',
    primary: '#7c3aed',
    gradient: 'linear-gradient(135deg, #1e1b4b 0%, #7c3aed 50%, #ec4899 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-autumn',     name: 'Otoño',
    primary: '#c2410c',
    gradient: 'linear-gradient(135deg, #fbbf24 0%, #c2410c 50%, #7c2d12 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-winter',     name: 'Invierno',
    primary: '#0284c7',
    gradient: 'linear-gradient(135deg, #f0f9ff 0%, #7dd3fc 50%, #0369a1 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-ocean-sunset', name: 'Sunset marino',
    primary: '#f97316',
    gradient: 'linear-gradient(135deg, #1e40af 0%, #ec4899 50%, #f97316 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-emerald-sky', name: 'Esmeralda',
    primary: '#059669',
    gradient: 'linear-gradient(135deg, #d1fae5 0%, #059669 50%, #164e63 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-rose-gold',  name: 'Rosé Gold',
    primary: '#d97706',
    gradient: 'linear-gradient(135deg, #fbcfe8 0%, #d97706 50%, #831843 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-peach',      name: 'Durazno',
    primary: '#fb923c',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fb923c 50%, #dc2626 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-galaxy',     name: 'Galaxia',
    primary: '#6d28d9',
    gradient: 'linear-gradient(135deg, #020617 0%, #6d28d9 40%, #f472b6 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-tequila',    name: 'Tequila Sunrise',
    primary: '#dc2626',
    gradient: 'linear-gradient(135deg, #fef08a 0%, #f97316 40%, #dc2626 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-jade',       name: 'Jade',
    primary: '#0d9488',
    gradient: 'linear-gradient(135deg, #a7f3d0 0%, #0d9488 50%, #134e4a 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-fire',       name: 'Llamas',
    primary: '#dc2626',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #ea580c 50%, #fbbf24 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-caribbean',  name: 'Caribe',
    primary: '#06b6d4',
    gradient: 'linear-gradient(135deg, #a7f3d0 0%, #06b6d4 50%, #1d4ed8 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-mocha',      name: 'Mocha',
    primary: '#78350f',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #92400e 50%, #451a03 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-electric',   name: 'Eléctrico',
    primary: '#2563eb',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #2563eb 50%, #7c3aed 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-flamingo',   name: 'Flamingo',
    primary: '#f43f5e',
    gradient: 'linear-gradient(135deg, #fda4af 0%, #f43f5e 50%, #9f1239 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-radial-sun', name: 'Radial Sol',
    primary: '#f59e0b',
    gradient: 'radial-gradient(circle at center, #fef08a 0%, #f59e0b 50%, #b45309 100%)',
    category: 'gradientes'
  },
  {
    id: 'grad-conic-rainbow', name: 'Arcoíris',
    primary: '#8b5cf6',
    gradient: 'conic-gradient(from 90deg at 50% 50%, #ef4444, #f59e0b, #10b981, #06b6d4, #8b5cf6, #ec4899, #ef4444)',
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
