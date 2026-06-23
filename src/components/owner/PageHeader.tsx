import Link from 'next/link';

/**
 * Header estándar para páginas del owner. Reemplaza el patrón duplicado
 * de "div con title + button" que estaba diferente en cada página.
 *
 * - Title obligatorio + description opcional.
 * - actions: slot para botones (ej. "+ Nueva publicación"). Se colocan a la
 *   derecha en desktop, debajo del título en mobile.
 * - back: link opcional "← X" para páginas de detalle (breadcrumb).
 *
 * No es sticky por default — algunas pages tienen tablas largas que
 * arruinan UX si el header se queda flotando. Cada page decide si
 * quiere wrap con sticky externo.
 */

export function PageHeader({
  title,
  description,
  back,
  actions
}: {
  title: string;
  description?: string;
  back?: { label: string; href: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1 text-xs text-white/45 hover:text-white mb-2"
        >
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-white/55 text-sm mt-1 max-w-2xl">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Botón "primario" del header — convención: bg blanco, texto negro.
 */
export function HeaderPrimary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90 whitespace-nowrap"
    >
      {children}
    </Link>
  );
}

/**
 * Botón "secundario" del header — convención: borde sutil, hover bg.
 */
export function HeaderSecondary({ href, external = false, children }: {
  href: string; external?: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="rounded-md border border-white/15 px-4 py-2 text-sm hover:bg-white/5 hover:border-white/30 whitespace-nowrap"
    >
      {children}
    </Link>
  );
}
