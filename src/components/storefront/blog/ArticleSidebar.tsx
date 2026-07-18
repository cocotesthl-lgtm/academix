'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';

export type SidebarArticle = {
  slug: string;
  title: string;
  cover_url: string | null;
  category_name: string | null;
};

/**
 * Sidebar de la página de nota — estilo Infobae/La Nación.
 *
 * Bloques (top-down):
 *   1. AD SLOT TOP (skyscraper vertical)
 *   2. Tabs "Más leídas" | "Lo Último" (ambos con thumb + título)
 *   3. AD SLOT MIDDLE (rectangle)
 *   4. "Te recomendamos" — STICKY con top-24
 *
 * El sticky funciona con top-24 (56px del dark bar + 40px de nav
 * categorías = 96px ≈ top-24). Se despega naturalmente cuando el
 * container `<aside>` se acaba (que ahora se extiende hasta el
 * final de "Últimas Noticias" gracias al refactor del article page).
 */
export function ArticleSidebar({
  articles,
  primary
}: {
  articles: SidebarArticle[];
  primary: string;
}) {
  const [activeTab, setActiveTab] = useState<'ultimo' | 'leidas'>('leidas');

  const ultimoList = articles.slice(0, 5);
  const leidasList = useMemo(() => {
    const arr = articles.slice();
    let seed = 42;
    arr.sort(() => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280 - 0.5;
    });
    return arr.slice(0, 5);
  }, [articles]);

  const recomendadosList = articles.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Ad top */}
      <AdSlotSidebar kind="skyscraper" label="Publicidad" />

      {/* Bloque tabs — todos con thumbnails */}
      <div className="border border-black/10">
        <div className="flex border-b-2 border-black/20">
          <TabBtn
            active={activeTab === 'leidas'}
            onClick={() => setActiveTab('leidas')}
            primary={primary}
          >
            Más leídas
          </TabBtn>
          <TabBtn
            active={activeTab === 'ultimo'}
            onClick={() => setActiveTab('ultimo')}
            primary={primary}
          >
            Lo Último
          </TabBtn>
        </div>
        <ul className="divide-y divide-black/5">
          {(activeTab === 'leidas' ? leidasList : ultimoList).map((a) => (
            <li key={a.slug} className="p-3">
              <Link href={`/blog/${a.slug}`} className="flex items-start gap-3 group">
                {a.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_url} alt="" className="w-16 h-16 object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-black/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {a.category_name && (
                    <div className="text-[10px] uppercase tracking-widest text-black/45 mb-0.5">
                      {a.category_name}
                    </div>
                  )}
                  <h4 className="font-serif text-[13px] font-bold leading-snug group-hover:underline">
                    {a.title}
                  </h4>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Ad middle */}
      <AdSlotSidebar kind="rectangle" label="Publicidad" />

      {/* Bloque "Te recomendamos" — sticky */}
      <div className="border border-black/10 sticky top-24">
        <div className="px-3 py-2 border-b-2 border-black/20">
          <strong className="text-sm">Te Recomendamos</strong>
        </div>
        <ul className="divide-y divide-black/5">
          {recomendadosList.map((a) => (
            <li key={a.slug} className="p-3">
              <Link href={`/blog/${a.slug}`} className="flex items-start gap-3 group">
                {a.cover_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.cover_url} alt="" className="w-16 h-16 object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 bg-black/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  {a.category_name && (
                    <div className="text-[10px] uppercase tracking-widest text-black/45 mb-0.5">
                      {a.category_name}
                    </div>
                  )}
                  <h4 className="font-serif text-[13px] font-bold leading-snug group-hover:underline">
                    {a.title}
                  </h4>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, primary, children
}: {
  active: boolean;
  onClick: () => void;
  primary: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2.5 text-sm font-bold transition relative ${
        active ? 'text-black' : 'text-black/45 hover:text-black/70'
      }`}
      style={active ? { boxShadow: `inset 0 -3px 0 0 ${primary}` } : undefined}
    >
      {children}
    </button>
  );
}

/**
 * Placeholder inline para ads en el sidebar. Rectangle o Skyscraper.
 * Cuando el owner conecte un ad network real, se reemplaza este componente
 * por el snippet del provider.
 */
function AdSlotSidebar({ kind, label }: { kind: 'rectangle' | 'skyscraper'; label: string }) {
  const aspect = kind === 'rectangle' ? '300 / 250' : '160 / 600';
  return (
    <div>
      <div className="text-center text-[10px] uppercase tracking-widest text-black/45 mb-1.5">
        {label}
      </div>
      <div className="w-full bg-black/[0.04] border border-dashed border-black/20 flex items-center justify-center text-black/40 text-xs uppercase tracking-widest"
        style={{ aspectRatio: aspect }}>
        Anuncio {kind === 'rectangle' ? '300×250' : '160×600'}
      </div>
    </div>
  );
}
