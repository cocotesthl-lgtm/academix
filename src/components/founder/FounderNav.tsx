'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Item = { label: string; href: string; sub?: boolean };

const ITEMS: Item[] = [
  { label: 'Dashboard',         href: '/dashboard' },
  { label: 'Sitios',            href: '/tenants' },
  { label: 'Usuarios',          href: '/users' },
  { label: 'Planes',            href: '/plans' },
  { label: '→ Códigos promo',   href: '/plans/promos',  sub: true },
  { label: '→ Banner',          href: '/plans/banner',  sub: true },
  { label: '→ Regalar plan',    href: '/plans/regalar', sub: true },
  { label: 'Comisiones',        href: '/commissions' },
  { label: 'Soporte',           href: '/tickets' },
  { label: 'Revenue',           href: '/revenue' },
  { label: '💰 Wallets',        href: '/wallets' }
];

function matches(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  if (pathname.startsWith(href + '/')) return true;
  return false;
}

export function FounderNav() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (pending && matches(pending, pathname)) setPending(null);
  }, [pathname, pending]);

  function go(href: string, e: React.MouseEvent) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (href === pathname) return;
    setPending(href);
    // Disparamos overlay manual (no dependemos de Next loading.tsx).
    window.dispatchEvent(new CustomEvent('cp:nav-start'));
    router.push(href);
  }

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {ITEMS.map((i) => {
        const active = matches(i.href, pathname) || pending === i.href;
        const isPending = pending === i.href;
        return (
          <a
            key={i.href}
            href={i.href}
            onClick={(e) => go(i.href, e)}
            className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 transition ${
              i.sub ? 'text-xs ml-3' : ''
            } ${
              active
                ? 'bg-white/10 text-white font-medium'
                : (i.sub ? 'text-white/55 hover:bg-white/5' : 'text-white/80 hover:bg-white/5')
            }`}
          >
            <span>{i.label}</span>
            {isPending && (
              <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            )}
          </a>
        );
      })}
    </nav>
  );
}
