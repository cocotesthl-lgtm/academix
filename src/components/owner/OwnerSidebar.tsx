'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';

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
type NavGroup = { label: string; icon: string; items: NavItem[] };
type NavEntry = { kind: 'item'; item: NavItem; icon: string } | { kind: 'group'; group: NavGroup };

const NAV: NavEntry[] = [
  { kind: 'item', icon: '🏠', item: { label: 'Inicio', href: '/dashboard' } },
  {
    kind: 'group',
    group: {
      label: 'Mis ventas', icon: '🛍️',
      items: [
        { label: 'Ofertas', href: '/courses' },
        { label: '💰 Saldos', href: '/wallets' },
        { label: '📋 Cuentas / Planes', href: '/cuentas' },
        { label: 'Contenido VIP', href: '/vip' },
        { label: 'Bundles', href: '/bundles' },
        { label: 'Categorías', href: '/categories' }
      ]
    }
  },
  {
    kind: 'group',
    group: {
      label: 'Eventos', icon: '🎟️',
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
      label: 'Personas', icon: '👥',
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
      label: 'Mi sitio', icon: '🎨',
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
      label: 'Configuración', icon: '⚙️',
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
    // OJO: NO envolver en startTransition. Envolver router.push en transition
    // hace que Next mantenga la página vieja visible y no dispare loading.tsx.
    // Sin transition: el sidebar re-renderea inmediato + loading.tsx aparece
    // en el área de contenido como en Wix.
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
              <span className="w-4 text-center">{entry.icon}</span>
              <span>{entry.item.label}</span>
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
              <span className="w-4 text-center">{entry.group.icon}</span>
              <span className="flex-1 font-medium">{entry.group.label}</span>
              <span className={`text-white/30 text-xs transition-transform ${isOpen ? 'rotate-90' : ''}`}>
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
