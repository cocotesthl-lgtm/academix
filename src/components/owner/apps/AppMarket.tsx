'use client';

import { useState, useMemo } from 'react';
import { toggleModuleAction } from '@/lib/modules/actions';
import type { ModuleKey } from '@/lib/modules/types';

export type AppCard = {
  key: ModuleKey;
  label: string;
  emoji: string;
  category: string;
  categoryKey: ModuleKey;
  description: string;
  longDescription: string;
  features: string[];
  installed: boolean;
  /** Rating fake (estable por key) — el usuario ve estrellas pero sabemos que es placeholder. */
  rating: number;
  reviews: number;
};

type Props = { apps: AppCard[]; categories: { key: string; label: string; emoji?: string }[] };

/**
 * App Market estilo Wix. Cards con icono, categoría, descripción y botón
 * de instalar. Click en la card abre modal de detalle con features.
 *
 * "Instalar" / "Desinstalar" llama a toggleModuleAction. La página server
 * re-renderiza con el estado nuevo tras el submit.
 */
export function AppMarket({ apps, categories }: Props) {
  const [selected, setSelected] = useState<AppCard | null>(null);
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      if (category !== 'all' && a.categoryKey !== category) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!a.label.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [apps, category, query]);

  return (
    <div className="space-y-5">
      {/* Buscador + filtro de categoría */}
      <div className="space-y-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 Buscar apps (ecommerce, cursos, afiliados…)"
          className="w-full rounded-lg bg-white/5 border border-white/15 px-4 py-2.5 text-sm placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <div className="flex flex-wrap gap-2">
          <CategoryChip active={category === 'all'} onClick={() => setCategory('all')} label="Todas" emoji="🧩" />
          {categories.map((c) => (
            <CategoryChip
              key={c.key}
              active={category === c.key}
              onClick={() => setCategory(c.key)}
              label={c.label}
              emoji={c.emoji}
            />
          ))}
        </div>
      </div>

      {/* Grid de cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((app) => (
          <AppCardTile key={app.key} app={app} onOpen={() => setSelected(app)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-white/40 py-12">
            No hay apps que coincidan con tu búsqueda.
          </div>
        )}
      </div>

      {/* Modal de detalle */}
      {selected && (
        <AppDetailModal app={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, label, emoji }: { active: boolean; onClick: () => void; label: string; emoji?: string }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full transition ${
        active
          ? 'bg-white text-black font-semibold'
          : 'border border-white/15 text-white/70 hover:bg-white/5'
      }`}
    >
      {emoji && <span className="mr-1">{emoji}</span>}
      {label}
    </button>
  );
}

function AppCardTile({ app, onOpen }: { app: AppCard; onOpen: () => void }) {
  return (
    <div
      onClick={onOpen}
      className="group relative rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/25 hover:-translate-y-0.5 transition cursor-pointer p-5 flex flex-col gap-3"
    >
      {/* Header: icono + nombre + tag categoría */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-2xl shrink-0">
          {app.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm leading-tight">{app.label}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/45 mt-0.5">{app.category}</div>
        </div>
        {app.installed && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 shrink-0">
            ✓ Instalada
          </span>
        )}
      </div>

      {/* Descripción corta */}
      <p className="text-xs text-white/60 leading-relaxed line-clamp-2 flex-1">
        {app.description}
      </p>

      {/* Rating + botón */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <Rating value={app.rating} reviews={app.reviews} />
        <span className="text-[11px] text-white/50 group-hover:text-white transition">Ver detalle →</span>
      </div>
    </div>
  );
}

function Rating({ value, reviews }: { value: number; reviews: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <div className="flex items-center gap-1 text-[11px] text-white/60">
      <div className="flex items-center gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => {
          if (i < full) return <span key={i}>★</span>;
          if (i === full && half) return <span key={i}>⯨</span>;
          return <span key={i} className="text-white/20">★</span>;
        })}
      </div>
      <span>{value.toFixed(1)}</span>
      <span className="text-white/40">({reviews})</span>
    </div>
  );
}

function AppDetailModal({ app, onClose }: { app: AppCard; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-white/15 bg-[#111] shadow-2xl"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition"
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Header hero */}
        <div className="p-6 pb-4 flex items-start gap-4 border-b border-white/10">
          <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center text-3xl shrink-0">
            {app.emoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wider text-white/45">{app.category}</div>
            <h2 className="text-xl font-bold mt-0.5">{app.label}</h2>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <Rating value={app.rating} reviews={app.reviews} />
              {app.installed && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                  ✓ Instalada
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body: descripción + features */}
        <div className="p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold mb-2 text-white/80">Descripción</h3>
            <p className="text-sm text-white/70 leading-relaxed">{app.longDescription}</p>
          </div>

          {app.features.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-white/80">Features principales</h3>
              <ul className="space-y-1.5">
                {app.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer: Install / Uninstall */}
        <div className="sticky bottom-0 p-5 border-t border-white/10 bg-[#111]/95 backdrop-blur flex items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            {app.installed
              ? 'Ya está activa. Podés desinstalarla si no la usás.'
              : 'Gratis · Se activa al instante · Podés desinstalarla en cualquier momento.'}
          </div>
          <form action={toggleModuleAction}>
            <input type="hidden" name="key" value={app.key} />
            <input type="hidden" name="enabled" value={app.installed ? 'false' : 'true'} />
            <button
              type="submit"
              onClick={() => setTimeout(onClose, 100)}
              className={`text-sm font-semibold rounded-lg px-5 py-2.5 transition ${
                app.installed
                  ? 'border border-red-400/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {app.installed ? 'Desinstalar' : '+ Instalar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
