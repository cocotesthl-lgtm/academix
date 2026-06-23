'use client';

import { useMemo, useState } from 'react';

export type AcademiaCard = {
  id: string;
  slug: string;
  name: string;
  primary_color: string | null;
  logo_url: string | null;
};

export function AcademiaSearch({
  sitios,
  rootDomain,
  isLocal
}: {
  sitios: AcademiaCard[];
  rootDomain: string;
  isLocal: boolean;
}) {
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return sitios;
    return sitios.filter(
      (a) => a.name.toLowerCase().includes(term) || a.slug.toLowerCase().includes(term)
    );
  }, [q, sitios]);

  function urlFor(slug: string) {
    if (isLocal) return `http://${slug}.localhost:3000`;
    return `https://${slug}.${rootDomain}`;
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <input
          type="text"
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscá por nombre o subdominio…"
          className="w-full rounded-xl bg-white/5 border border-white/20 px-5 py-4 text-lg placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
          {filtered.length} resultado{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="text-white/60">No encontramos sitios con ese nombre.</p>
          <p className="text-white/40 text-sm mt-2">
            ¿Querés sumar la tuya?{' '}
            <a href="/signup" className="underline text-white">Creala gratis</a>.
          </p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-4">
          {filtered.map((a) => {
            const primary = a.primary_color ?? '#a855f7';
            const initial = a.name.slice(0, 1).toUpperCase();
            return (
              <li key={a.id}>
                <a
                  href={urlFor(a.slug)}
                  className="block rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:bg-white/[0.05] hover:border-white/20 transition"
                >
                  <div className="flex items-center gap-4">
                    {a.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.logo_url} alt={a.name} className="w-12 h-12 rounded-lg object-contain bg-white p-1" />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg"
                        style={{ background: primary }}
                      >
                        {initial}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{a.name}</h3>
                      <p className="text-xs text-white/40 truncate">{a.slug}.{rootDomain}</p>
                    </div>
                    <span
                      className="text-xs font-medium px-3 py-1.5 rounded-md text-white"
                      style={{ background: primary }}
                    >
                      Entrar →
                    </span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
