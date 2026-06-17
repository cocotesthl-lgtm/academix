'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useMemo } from 'react';

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
      label: 'Mis creaciones', icon: '✨',
      items: [
        { label: 'Cursos', href: '/courses' },
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
        { label: 'Asistencia', href: '/eventos/asistencia' }
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

  function toggle(label: string) {
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {NAV.map((entry) => {
        if (entry.kind === 'item') {
          const active = pathMatches(entry.item.href, pathname);
          return (
            <Link
              key={entry.item.href}
              href={entry.item.href}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 transition ${
                active
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="w-4 text-center">{entry.icon}</span>
              <span>{entry.item.label}</span>
            </Link>
          );
        }
        const isOpen = open[entry.group.label] ?? false;
        const hasActive = groupContainsActive(entry.group, pathname);
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
                  const active = pathMatches(item.href, pathname);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-md px-2.5 py-1.5 transition text-[13px] ${
                        active
                          ? 'bg-white/10 text-white font-medium'
                          : 'text-white/70 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
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
