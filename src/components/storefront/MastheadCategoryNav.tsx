'use client';

import { usePathname, useSearchParams } from 'next/navigation';

type NavLink = { id: string; label: string; href: string };

/**
 * Nav de categorías del masthead editorial (news). Client component
 * para poder resaltar la categoría activa comparando pathname / cat=
 * con el href de cada link. La activa lleva un underline grueso
 * negro estilo The Times.
 */
export function MastheadCategoryNav({ links }: { links: NavLink[] }) {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const currentCat = searchParams?.get('cat') ?? null;

  function isActive(href: string): boolean {
    // href puede ser algo tipo "/blog?cat=deportes" o "/blog" o "/"
    if (!href) return false;
    // Extraer path y query
    const [path, qs = ''] = href.split('?');
    const linkCat = new URLSearchParams(qs).get('cat');
    // Match exacto de path para links sin ?cat=
    if (!linkCat) return pathname === path;
    // Con ?cat=, comparamos también con el cat activo
    return pathname === path && currentCat === linkCat;
  }

  return (
    <nav className="max-w-6xl mx-auto px-6 flex items-center justify-center gap-5 md:gap-8 text-[13px] font-semibold text-black flex-wrap">
      {links.map((l) => {
        const active = isActive(l.href);
        return (
          <a
            key={l.id}
            href={l.href}
            className={`py-3 hover:opacity-70 transition uppercase tracking-wide ${
              active ? 'relative' : ''
            }`}
            style={active ? { boxShadow: 'inset 0 -3px 0 0 #000' } : undefined}
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
