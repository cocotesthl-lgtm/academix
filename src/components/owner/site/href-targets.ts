/**
 * Helpers plain-TS (sin 'use client') para generar targets del HrefField.
 * Vive separado de HrefSelect.tsx porque éste es client-only y los server
 * components no pueden importar funciones desde un archivo marcado como
 * 'use client'.
 */

export type HrefTarget = { value: string; label: string; group: string };

/**
 * Server-side: genera los targets dinámicos del tenant (publicaciones + sus checkouts).
 * El resultado se pasa al <HrefTargetsProvider /> que inyecta los targets en
 * todos los HrefField/HrefSelect descendientes.
 */
export function buildCourseTargets(courses: Array<{ slug: string; title: string }>): HrefTarget[] {
  const out: HrefTarget[] = [];
  for (const c of courses) {
    out.push({ value: `/c/${c.slug}`, label: `📚 ${c.title}`, group: 'Publicaciones' });
    out.push({ value: `/c/${c.slug}#comprar`, label: `🛒 Checkout — ${c.title}`, group: 'Checkout / Compra' });
  }
  return out;
}
