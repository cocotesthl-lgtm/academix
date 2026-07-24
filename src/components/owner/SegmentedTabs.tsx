'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * SegmentedTabs — header horizontal con tabs para unificar visualmente
 * un grupo de páginas del owner panel que conceptualmente son "una sola
 * experiencia" aunque técnicamente vivan en rutas distintas.
 *
 * F5 (evolución nav): la usa el módulo Ventas (Ventas/Suscripciones/
 * Saldos/Finanzas) y el módulo Contactos (Clientes/Pipeline) para dar
 * sensación de una app coherente en vez de páginas huérfanas.
 *
 * No cambia URLs ni redirige — solo pinta un nav-strip arriba del
 * contenido de la page.
 */
export function SegmentedTabs({
  tabs,
  title,
  description
}: {
  tabs: Array<{ label: string; href: string; icon?: string; badge?: string }>;
  title?: string;
  description?: string;
}) {
  const pathname = usePathname() ?? '';

  return (
    <div className="mb-6">
      {(title || description) && (
        <div className="mb-4">
          {title && <h1 className="text-2xl font-bold">{title}</h1>}
          {description && <p className="text-white/55 text-sm mt-1">{description}</p>}
        </div>
      )}
      <nav className="flex gap-1 border-b border-white/10 overflow-x-auto no-scrollbar">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 flex items-center gap-1.5 ${
                active
                  ? 'border-white text-white'
                  : 'border-transparent text-white/55 hover:text-white/80 hover:border-white/20'
              }`}
            >
              {t.icon && <span className="text-xs">{t.icon}</span>}
              <span>{t.label}</span>
              {t.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  active ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'
                }`}>
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Preset: pestañas del módulo Ventas (F5). */
export const SALES_TABS = [
  { label: 'Ventas', href: '/ventas', icon: '💰' },
  { label: 'Suscripciones', href: '/suscripciones', icon: '🔄' },
  { label: 'Saldos', href: '/wallets', icon: '👛' },
  { label: 'Finanzas', href: '/finance', icon: '📊' }
];

/** Preset: pestañas del módulo Contactos (F5). */
export const CONTACTS_TABS = [
  { label: 'Clientes',    href: '/clientes',  icon: '👤' },
  { label: 'Buzón',       href: '/crm/inbox', icon: '📥' },
  { label: 'Pipeline',    href: '/crm',       icon: '📋' }
];
