import Link from 'next/link';

/**
 * Empty state reusable. Cuando una pantalla está vacía, en lugar de
 * "no hay nada acá" mostrar:
 *  - Icono visual claro
 *  - Frase corta explicando QUÉ es
 *  - 1-2 acciones primarias para resolver el vacío
 *
 * Inspirado en empty states de Linear/Notion/Stripe — el principio es
 * NUNCA dejar al user en una pantalla vacia sin saber qué hacer.
 */
export function EmptyState({
  icon,
  title,
  description,
  primary,
  secondary
}: {
  icon: string;
  title: string;
  description: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.01] p-10 text-center">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm text-white/55 mt-2 max-w-md mx-auto">{description}</p>
      {(primary || secondary) && (
        <div className="flex items-center justify-center gap-2 mt-5">
          {primary && (
            <Link
              href={primary.href}
              className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90"
            >
              {primary.label}
            </Link>
          )}
          {secondary && (
            <Link
              href={secondary.href}
              className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5"
            >
              {secondary.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
