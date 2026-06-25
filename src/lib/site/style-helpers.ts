/**
 * Helpers para aplicar los styles avanzados (bg image, text effects,
 * button styles) en el storefront renderer.
 *
 * Se llaman desde app/storefront/[tenantId]/page.tsx para cada sección.
 */

import type { CSSProperties } from 'react';

/**
 * Construye el style del background de una sección combinando:
 * - bg_color sólido
 * - bg_image_url con opacidad y modo (cover/contain/repeat)
 *
 * Devuelve un objeto CSS listo para usar en style={}.
 * El fallback es el background actual (caller decide qué pasar como `fallback`).
 *
 * IMPORTANTE: cuando hay imagen, usamos linear-gradient overlay para
 * combinarla con el bg_color sin perder ambos. Esto da el efecto
 * "patron + tinte" que el user pidió.
 */
type SectionStyleInput = {
  bg_color?: string | null;
  bg_image_url?: string | null;
  bg_image_opacity?: number | null;
  bg_image_position?: string | null;
};

export function sectionBgStyle(
  s: SectionStyleInput,
  fallback?: string
): CSSProperties {
  const bg = s.bg_color ?? fallback ?? undefined;
  if (!s.bg_image_url) {
    return bg ? { background: bg } : {};
  }
  const opacity = typeof s.bg_image_opacity === 'number' ? s.bg_image_opacity : 1;
  const mode = s.bg_image_position ?? '';

  // Color overlay: combinamos bg_color + imagen con opacidad.
  // Si bg_color no existe, usamos negro transparente (1 - opacity) para
  // simular la opacidad sobre cualquier base.
  const overlay = bg
    ? `linear-gradient(rgba(0,0,0,${1 - opacity}), rgba(0,0,0,${1 - opacity})), ${bg}`
    : `rgba(0,0,0,${1 - opacity})`;

  const sizing =
    mode === 'contain' ? { backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }
    : mode === 'repeat' ? { backgroundSize: 'auto', backgroundRepeat: 'repeat' }
    : mode === 'center' ? { backgroundSize: 'auto', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }
    : { backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' };

  return {
    backgroundImage: `url("${s.bg_image_url.replace(/"/g, '%22')}"), ${overlay}`,
    ...sizing
  };
}

/**
 * Aplica un text-effect a un elemento (típicamente h1/h2).
 * Devuelve el `textShadow` correspondiente.
 */
export function textEffectStyle(effect: string | null | undefined, color = '#f97316'): CSSProperties {
  switch (effect) {
    case 'shadow':
      return { textShadow: '0 2px 8px rgba(0,0,0,0.4)' };
    case 'glow':
      return { textShadow: `0 0 18px ${color}66, 0 0 36px ${color}33` };
    case 'neon':
      return {
        textShadow: `0 0 4px ${color}, 0 0 12px ${color}, 0 0 24px ${color}, 0 0 48px ${color}66`,
        color
      };
    case 'outline':
      return {
        WebkitTextStroke: `1px ${color}`,
        color: 'transparent'
      };
    default:
      return {};
  }
}

/**
 * Style para CTA buttons usando los overrides de la sección.
 * accent es el color de fallback (tenant primary).
 */
type ButtonStyleInput = {
  button_bg_color?: string | null;
  button_text_color?: string | null;
  button_border_color?: string | null;
  button_glow?: boolean | null;
  accent_color?: string | null;
};

export function buttonStyle(s: ButtonStyleInput, accent: string): CSSProperties {
  const bg = s.button_bg_color ?? s.accent_color ?? accent;
  const text = s.button_text_color ?? '#ffffff';
  const border = s.button_border_color ?? bg;
  const glow = s.button_glow ? `0 0 18px ${bg}80, 0 0 36px ${bg}40` : undefined;
  return {
    background: bg,
    color: text,
    border: `1px solid ${border}`,
    boxShadow: glow
  };
}

/** ¿Los botones de esta sección deben renderizarse? */
export function buttonsVisible(s: { button_hidden?: boolean | null }): boolean {
  return !s.button_hidden;
}
