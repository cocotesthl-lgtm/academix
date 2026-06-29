'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';

/**
 * Iconos line-style (estilo Lucide/Feather, no coloridos).
 * No usamos emojis para no romper la paleta gráfica.
 */
type IconName = 'home' | 'shopping-bag' | 'ticket' | 'users' | 'palette' | 'settings';

function Icon({ name, className = 'w-4 h-4' }: { name: IconName; className?: string }) {
  const props = {
    className,
    width: 16, height: 16, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const
  };
  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 12L12 3l9 9"/><path d="M5 10v10h14V10"/></svg>;
    case 'shopping-bag':
      return <svg {...props}><path d="M6 7h12l-1 13H7L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg>;
    case 'ticket':
      return <svg {...props}><path d="M3 7h18v4a2 2 0 0 0 0 4v2H3v-2a2 2 0 0 0 0-4V7z"/><path d="M13 7v10" strokeDasharray="2 2"/></svg>;
    case 'users':
      return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15h2a3 3 0 0 1 3 3v1"/></svg>;
    case 'palette':
      return <svg {...props}><path d="M12 3a9 9 0 1 0 9 9c0-2-2-2-2-4s2-2 2-4a5 5 0 0 0-5-5"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="11.5" cy="7.5" r="1.2"/><circle cx="16.5" cy="11.5" r="1.2"/></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.4a7 7 0 0 0-2 1.2L5.1 5.8l-2 3.5 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.5 2.4-.8a7 7 0 0 0 2 1.2L10 21h4l.5-2.4a7 7 0 0 0 2-1.2l2.4.8 2-3.5-2-1.5a7 7 0 0 0 .1-1.2z"/></svg>;
  }
}

/**
 * Sidebar agrupada del owner panel.
 *
 * - 6 secciones colapsables (Inicio + 5 grupos).
 * - Auto-expande el grupo que contiene la ruta actual.
 * - Estado activo visual sobre el ítem matched.
 * - El estado de colapso se persiste en sessionStorage (sobrevive
 *   navegación, se resetea al cerrar tab — defensivo si guardamos algo
 *   raro).
 */

type NavItem = { label: string; href: string; badge?: string };
type NavGroup = { label: string; icon: IconName; items: NavItem[] };
type NavEntry = { kind: 'item'; item: NavItem; icon: IconName } | { kind: 'group'; group: NavGroup };

const NAV: NavEntry[] = [
  { kind: 'item', icon: 'home', item: { label: 'Inicio', href: '/dashboard' } },
  {
    kind: 'group',
    group: {
      label: 'Mis ventas', icon: 'shopping-bag',
      items: [
        { label: 'Ofertas', href: '/courses' },
        { label: 'Saldos', href: '/wallets' },
        { label: 'Cuentas / Planes', href: '/cuentas' },
        { label: 'Contenido VIP', href: '/vip' },
        { label: 'Bundles', href: '/bundles' },
        { label: 'Categorías', href: '/categories' }
      ]
    }
  },
  {
    kind: 'group',
    group: {
      label: 'Eventos', icon: 'ticket',
      items: [
        { label: 'Calendario', href: '/eventos/calendario' },
        { label: 'Validar entradas', href: '/eventos/validar' },
        { label: 'Asistencia', href: '/eventos/asistencia' },
        { label: 'Sedes', href: '/venues' },
        { label: 'Reservas', href: '/reservas' }
      ]
    }
  },
  {
    kind: 'group',
    group: {
      label: 'Personas', icon: 'users',
      items: [
        { label: 'Clientes', href: '/clientes' },
        { label: 'CRM (leads)', href: '/crm' },
        { label: 'Formularios', href: '/forms' },
        { label: 'Equipo', href: '/equipo' },
        { label: 'Mensajes', href: '/mensajes' },
        { label: 'Ventas', href: '/ventas' },
        { label: 'Suscripciones', href: '/suscripciones' },
        { label: 'Instructores', href: '/instructors' },
        { label: 'Afiliados', href: '/affiliates' }
      ]
    }
  },
  {
    kind: 'group',
    group: {
      label: 'Mi sitio', icon: 'palette',
      items: [
        { label: 'Editor de páginas', href: '/site' },
        { label: 'Templates', href: '/templates' },
        { label: 'Identidad', href: '/branding' },
        { label: 'Checkout', href: '/checkout' },
        { label: 'Cupones', href: '/coupons' }
      ]
    }
  },
  {
    kind: 'group',
    group: {
      label: 'Configuración', icon: 'settings',
      items: [
        { label: 'Mi plan', href: '/mi-plan' },
        { label: 'Mi dominio', href: '/dominio' },
        { label: 'Integraciones', href: '/integrations' },
        { label: 'Finanzas', href: '/finance' },
        { label: 'Soporte', href: '/soporte' }
      ]
    }
  }
];

function pathMatches(itemHref: string, pathname: string): boolean {
  if (itemHref === pathname) return true;
  // /soporte matchea /soporte/new, /soporte/[id], etc.
  if (pathname.startsWith(itemHref + '/')) return true;
  return false;
}

function groupContainsActive(group: NavGroup, pathname: string): boolean {
  return group.items.some((i) => pathMatches(i.href, pathname));
}

export function OwnerSidebar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  // Highlight optimista — el item se marca activo APENAS se clickea,
  // sin esperar que la page nueva termine de cargar.
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  // Cuando el pathname finalmente cambia al destino, limpiamos el optimista.
  useEffect(() => {
    if (pendingHref && pathMatches(pendingHref, pathname)) {
      setPendingHref(null);
    }
  }, [pathname, pendingHref]);

  function navigate(href: string) {
    if (href === pathname) return;
    setPendingHref(href);
    // Disparamos overlay manual (no dependemos de Next loading.tsx que no
    // siempre dispara visiblemente). El PendingNavOverlay lo escucha.
    window.dispatchEvent(new CustomEvent('cp:nav-start'));
    router.push(href);
  }

  // Un item está "activo" si la ruta actual matchea O si está pending hacia él.
  function isActive(href: string): boolean {
    return pathMatches(href, pathname) || pendingHref === href;
  }

  // Inicial: expandido si contiene la ruta actual
  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    NAV.forEach((entry) => {
      if (entry.kind === 'group') {
        map[entry.group.label] = groupContainsActive(entry.group, pathname);
      }
    });
    return map;
  }, [pathname]);

  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  // Si el usuario navega a un item dentro de un grupo cerrado, abrirlo
  // automáticamente para que el highlight sea visible.
  useEffect(() => {
    if (!pendingHref) return;
    setOpen((prev) => {
      const next = { ...prev };
      for (const entry of NAV) {
        if (entry.kind === 'group' && entry.group.items.some((i) => i.href === pendingHref)) {
          next[entry.group.label] = true;
        }
      }
      return next;
    });
  }, [pendingHref]);

  function toggle(label: string) {
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV.map((entry) => {
        if (entry.kind === 'item') {
          const active = isActive(entry.item.href);
          return (
            <a
              key={entry.item.href}
              href={entry.item.href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                e.preventDefault();
                navigate(entry.item.href);
              }}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 transition ${
                active
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon name={entry.icon} className="w-4 h-4 text-white/60 shrink-0" />
              <span className="cp-collapse-hide">{entry.item.label}</span>
            </a>
          );
        }
        const isOpen = open[entry.group.label] ?? false;
        const hasActive = groupContainsActive(entry.group, pathname)
          || entry.group.items.some((i) => i.href === pendingHref);
        return (
          <div key={entry.group.label} className="mt-1">
            <button
              type="button"
              onClick={() => toggle(entry.group.label)}
              className={`w-full flex items-center gap-2 rounded-md px-2.5 py-2 transition text-left ${
                hasActive ? 'text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon name={entry.group.icon} className="w-4 h-4 text-white/60 shrink-0" />
              <span className="flex-1 font-medium cp-collapse-hide">{entry.group.label}</span>
              <span className={`text-white/30 text-xs transition-transform cp-collapse-hide ${isOpen ? 'rotate-90' : ''}`}>
                ›
              </span>
            </button>
            {isOpen && (
              <div className="ml-6 mt-0.5 mb-1 flex flex-col gap-0.5 border-l border-white/10 pl-2">
                {entry.group.items.map((item) => {
                  const active = isActive(item.href);
                  const isPending = pendingHref === item.href;
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                        e.preventDefault();
                        navigate(item.href);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 transition text-[13px] ${
                        active
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <span>{item.label}</span>
                      {isPending && (
                        <span className="inline-block w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
