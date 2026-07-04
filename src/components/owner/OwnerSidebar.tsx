'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useMemo, useEffect } from 'react';
import { ALL_MODULES_ON, type ModuleKey, type Modules } from '@/lib/modules/types';
import { viewableModules, type Permissions } from '@/lib/permissions/types';

/**
 * Iconos line-style (estilo Lucide/Feather, no coloridos).
 * No usamos emojis para no romper la paleta gráfica.
 */
type IconName = 'home' | 'shopping-bag' | 'calendar' | 'megaphone' | 'users' | 'dollar' | 'palette' | 'settings';

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
    case 'calendar':
      return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>;
    case 'megaphone':
      return <svg {...props}><path d="M3 11v2a2 2 0 0 0 2 2h1l3 5v-4h1l7 3V5l-7 3H9v3"/><path d="M18 8v8"/></svg>;
    case 'users':
      return <svg {...props}><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/><circle cx="17" cy="9" r="2.5"/><path d="M16 15h2a3 3 0 0 1 3 3v1"/></svg>;
    case 'dollar':
      return <svg {...props}><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
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
type NavGroup = { label: string; icon: IconName; items: NavItem[]; moduleKey?: ModuleKey };
type NavEntry = { kind: 'item'; item: NavItem; icon: IconName } | { kind: 'group'; group: NavGroup };

// F1 (evolución nav): mismos ítems que antes, mejor agrupados.
// Nada de rutas cambia — /courses sigue siendo /courses, etc. Solo se mueve
// el árbol para que grupos tengan coherencia semántica.
const NAV: NavEntry[] = [
  { kind: 'item', icon: 'home', item: { label: 'Inicio', href: '/dashboard' } },

  // Todo lo que ofrecés + cómo se compra
  {
    kind: 'group',
    group: {
      label: 'Catálogo', icon: 'shopping-bag', moduleKey: 'catalog',
      items: [
        { label: 'Publicaciones', href: '/courses' },      // era "Ofertas"
        { label: 'Productos físicos', href: '/products' }, // ecommerce físico
        { label: 'Contenido VIP', href: '/vip' },
        { label: 'Bundles', href: '/bundles' },
        { label: 'Categorías', href: '/categories' },
        { label: 'Envíos', href: '/shipping' },            // zonas + tarifas
        { label: 'Cupones', href: '/coupons' },            // movido desde "Mi sitio"
        { label: 'Checkout', href: '/checkout' }           // movido desde "Mi sitio"
      ]
    }
  },

  // Todo lo que tiene fecha/hora (renombré "Eventos" → "Agenda")
  {
    kind: 'group',
    group: {
      label: 'Agenda', icon: 'calendar', moduleKey: 'calendar',
      items: [
        { label: 'Calendario', href: '/eventos/calendario' },
        { label: 'Reservas', href: '/reservas' },
        { label: 'Validar entradas', href: '/eventos/validar' },
        { label: 'Asistencia', href: '/eventos/asistencia' },
        { label: 'Sedes', href: '/venues' }
      ]
    }
  },

  // Captación + conversión + comunicación (afiliados va acá porque su
  // función funcional es traer leads)
  {
    kind: 'group',
    group: {
      label: 'CRM & Marketing', icon: 'megaphone', moduleKey: 'crm',
      items: [
        { label: 'Leads', href: '/crm' },                  // era "CRM (leads)"
        { label: 'Clientes', href: '/clientes' },
        { label: 'Blog', href: '/blog' },                  // Módulo nuevo — artículos editoriales
        { label: 'Formularios', href: '/forms' },
        { label: 'Mensajes', href: '/mensajes' },
        { label: 'Afiliados', href: '/affiliates' }        // movido desde "Personas"
      ]
    }
  },

  // Solo gente que trabaja con vos (staff / instructores)
  {
    kind: 'group',
    group: {
      label: 'Personas', icon: 'users', moduleKey: 'team',
      items: [
        { label: 'Equipo', href: '/equipo' },
        { label: 'Instructores', href: '/instructors' }
      ]
    }
  },

  // Todo el dinero en un solo lugar
  {
    kind: 'group',
    group: {
      label: 'Ventas', icon: 'dollar', moduleKey: 'sales',
      items: [
        { label: 'Ventas', href: '/ventas' },
        { label: 'Órdenes (tienda)', href: '/orders' },     // ecommerce físico
        { label: 'Suscripciones', href: '/suscripciones' },
        { label: 'Saldos', href: '/wallets' },              // movido desde "Mis ventas"
        { label: 'Finanzas', href: '/finance' }             // movido desde "Configuración"
      ]
    }
  },

  // Solo lo visual + su dirección web
  {
    kind: 'group',
    group: {
      label: 'Mi sitio', icon: 'palette', moduleKey: 'site',
      items: [
        { label: 'Editor de páginas', href: '/site' },
        { label: 'Templates', href: '/templates' },
        { label: 'Identidad', href: '/branding' },
        { label: 'Dominio', href: '/dominio' }              // movido desde "Configuración"
      ]
    }
  },

  // Solo lo de la plataforma Curplat, no del negocio
  {
    kind: 'group',
    group: {
      label: 'Configuración', icon: 'settings',
      items: [
        { label: 'Mi plan', href: '/mi-plan' },
        { label: 'Módulos', href: '/modulos' },              // F2: qué módulos usa este workspace
        { label: 'Cuentas / Planes', href: '/cuentas' },    // movido desde "Mis ventas"
        { label: 'Integraciones', href: '/integrations' },
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

export function OwnerSidebar({
  modules = ALL_MODULES_ON,
  permissions = null
}: {
  modules?: Modules;
  /** Null = owner (todo visible). Sino se filtra a lo que el user puede ver. */
  permissions?: Permissions | null;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  // Filtrar grupos por dos capas:
  //   1) módulos ACTIVOS del workspace (F2)
  //   2) permisos del user en este workspace (F3.a)
  // Grupos sin moduleKey (Inicio, Configuración) siempre visibles.
  // Si permissions es null → tratamos como owner (retrocompat + safety
  // hasta que F3.b propague permisos por todos los flows).
  const viewable = useMemo(() => viewableModules(permissions), [permissions]);
  const treatAsOwner = permissions === null;

  const visibleNav = useMemo(() => {
    return NAV.filter((entry) => {
      if (entry.kind === 'item') return true;
      const key = entry.group.moduleKey;
      if (!key) return true;
      if (modules[key] === false) return false;
      if (treatAsOwner) return true;
      return viewable.has(key);
    });
  }, [modules, viewable, treatAsOwner]);
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
    visibleNav.forEach((entry) => {
      if (entry.kind === 'group') {
        map[entry.group.label] = groupContainsActive(entry.group, pathname);
      }
    });
    return map;
  }, [pathname, visibleNav]);

  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  // Si el usuario navega a un item dentro de un grupo cerrado, abrirlo
  // automáticamente para que el highlight sea visible.
  useEffect(() => {
    if (!pendingHref) return;
    setOpen((prev) => {
      const next = { ...prev };
      for (const entry of visibleNav) {
        if (entry.kind === 'group' && entry.group.items.some((i) => i.href === pendingHref)) {
          next[entry.group.label] = true;
        }
      }
      return next;
    });
  }, [pendingHref, visibleNav]);

  function toggle(label: string) {
    setOpen((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <nav className="flex flex-col gap-0.5 text-sm">
      {visibleNav.map((entry) => {
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
