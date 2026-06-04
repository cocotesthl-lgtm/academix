/**
 * Helpers de contraste para que el storefront se vea bien cuando el owner
 * elige un color de fondo oscuro en alguna sección. Sin esto, todos los
 * `text-black/XX` quedan invisibles sobre un bg negro.
 *
 * La idea: cada <section> recibe data-section-theme="dark|light". El CSS en
 * globals.css invierte automáticamente los text-black/XX, bg-white,
 * border-black/XX cuando el theme es dark.
 */

/**
 * Parsea un color hex (#rgb, #rrggbb) o un linear-gradient simple y devuelve
 * su luminancia relativa según WCAG (0 = negro, 1 = blanco).
 * Si no puede parsear, asume 1 (claro) para no romper el render.
 */
export function relativeLuminance(input: string | null | undefined): number {
  if (!input) return 1;
  const v = input.trim().toLowerCase();

  // Si es gradient, intentar agarrar el primer color y juzgar por ahí.
  if (v.startsWith('linear-gradient') || v.startsWith('radial-gradient')) {
    const m = v.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/);
    if (m) return relativeLuminance(m[0]);
    return 1;
  }

  // rgb / rgba
  const rgbMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return wcagLuminance(+rgbMatch[1], +rgbMatch[2], +rgbMatch[3]);
  }

  // hex
  if (v.startsWith('#')) {
    let hex = v.slice(1);
    if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
    if (hex.length === 4) hex = hex.slice(0, 3).split('').map((c) => c + c).join(''); // #rgba ignora alpha
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (![r, g, b].some(Number.isNaN)) return wcagLuminance(r, g, b);
    }
  }
  return 1;
}

function wcagLuminance(r: number, g: number, b: number): number {
  const toLin = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
}

/** True si el color debería tratarse como oscuro (texto blanco encima). */
export function isDarkColor(input: string | null | undefined): boolean {
  if (!input) return false;
  return relativeLuminance(input) < 0.45;
}

/** 'dark' | 'light' — para usar como data-section-theme. */
export function sectionTheme(bg: string | null | undefined): 'dark' | 'light' {
  return isDarkColor(bg) ? 'dark' : 'light';
}
