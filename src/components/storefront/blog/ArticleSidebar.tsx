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
 * Tiene tres bloques configurables (arriba tabs, abajo lista):
 *   - Lo Último (últimos por fecha)
 *   - Más leídas (proxy: orden aleatorio determinístico por ahora)
 *   - Te recomendamos (mezcla del pool)
 *
 * El bloque "Te recomendamos" es sticky con top-24 → mientras el usuario
 * scrollea leyendo la nota, el bloque queda pegado a la vista.
 *
 * TODO: cuando exista tracking de views, "Más leídas" ordena por view_count
 * y "Te recomendamos" usa un ranking por category match + freshness.
 * Por ahora los 3 usan la misma lista base con distinto orden.
 */
export function ArticleSidebar({
  articles,
  primary
}: {
  articles: SidebarArticle[];
  primary: string;
}) {
  const [activeTab, setActiveTab] = useState<'ultimo' | 'leidas'>('leidas');

  // "Más leídas" = orden aleatorio pero estable por slug (sirve como proxy
  // hasta que tengamos view tracking). "Lo último" = orden natural
  // (los artículos ya vienen ordenados por published_at DESC del helper).
  const ultimoList = articles.slice(0, 6);
  const leidasList = useMemo(() => {
    const arr = articles.slice();
    // Shuffle determinístico
    let seed = 42;
    arr.sort(() => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280 - 0.5;
    });
    return arr.slice(0, 6);
  }, [articles]);

  // "Te recomendamos" = 4 artículos con thumbs — sticky, siempre visible
  const recomendadosList = articles.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Bloque 1: Lo Último / Más leídas (tabs) */}
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
        <ol className="divide-y divide-black/5">
          {(activeTab === 'leidas' ? leidasList : ultimoList).map((a, i) => (
            <li key={a.slug} className="p-3">
              <Link href={`/blog/${a.slug}`} className="flex items-start gap-3 group">
                <span className="text-2xl font-black shrink-0 leading-none" style={{ color: primary }}>
                  {i + 1}
                </span>
                <span className="font-serif text-sm font-bold leading-snug group-hover:underline">
                  {a.title}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>

      {/* Bloque 2: Te recomendamos — STICKY */}
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
