/**
 * Conventions únicas para los links de afiliado.
 * Mantener el nombre de los query params + variantes en UN SOLO LUGAR
 * para que cambios futuros no requieran greps en N archivos.
 */

export const REF_PARAM = 'ref';
export const VARIANT_PARAM = 'v';
export const VARIANT_KEYS = ['A', 'B', 'C'] as const;
export type VariantKey = typeof VARIANT_KEYS[number];

export function isVariantKey(v: string | null | undefined): v is VariantKey {
  return !!v && (VARIANT_KEYS as ReadonlyArray<string>).includes(v);
}

/**
 * Construye el URL público de la landing de un curso con (opcionalmente)
 * el código de afiliado y la variante. Si origin viene vacío usa relativo.
 */
export function buildCourseUrl(opts: {
  origin?: string;          // ej "https://kan.bzseguridad.store" — opcional
  courseSlug: string;
  ref?: string | null;
  variant?: VariantKey | null;
}): string {
  const base = `${opts.origin ?? ''}/c/${opts.courseSlug}`;
  const qs: string[] = [];
  if (opts.ref)     qs.push(`${REF_PARAM}=${encodeURIComponent(opts.ref)}`);
  if (opts.variant && opts.variant !== 'A') qs.push(`${VARIANT_PARAM}=${opts.variant}`);
  return qs.length === 0 ? base : `${base}?${qs.join('&')}`;
}
