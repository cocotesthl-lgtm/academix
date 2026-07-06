'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';

const REASON_MSG: Record<string, string> = {
  empty: 'Escribí el nombre que querés para tu sitio.',
  too_short: 'Necesitás al menos 3 letras.',
  too_long: 'Máximo 40 caracteres.',
  invalid_chars: 'Solo letras, números y guiones. Empieza y termina con letra o número.',
  reserved: 'Ese nombre está reservado por la plataforma. Probá con otro.',
  taken: 'Ese nombre ya está en uso. Probá una variación.'
};

type Result =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available'; slug: string }
  | { status: 'unavailable'; slug: string; reason: string };

/**
 * Widget de la landing para probar disponibilidad de subdominio.
 * - Input + botón "Comprobar" (rounded-full match con el resto de la landing)
 * - Al comprobar, hace fetch a /api/domain-check y muestra card verde
 *   si disponible + CTA "Empezá ahora" → /signup?slug=<slug>
 * - Card roja con hint si no está disponible
 * - Debounce implícito por click (no auto-check para no bombardear DB)
 */
export function DomainChecker() {
  const [slug, setSlug] = useState('');
  const [result, setResult] = useState<Result>({ status: 'idle' });
  const [pending, startTransition] = useTransition();

  function normalize(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip acentos
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 40);
  }

  function check() {
    const clean = normalize(slug);
    setSlug(clean);
    if (!clean) {
      setResult({ status: 'unavailable', slug: '', reason: 'empty' });
      return;
    }
    setResult({ status: 'checking' });
    startTransition(async () => {
      try {
        const res = await fetch(`/api/domain-check?slug=${encodeURIComponent(clean)}`);
        const data = await res.json() as { available: boolean; reason?: string };
        if (data.available) {
          setResult({ status: 'available', slug: clean });
        } else {
          setResult({ status: 'unavailable', slug: clean, reason: data.reason ?? 'taken' });
        }
      } catch {
        setResult({ status: 'unavailable', slug: clean, reason: 'taken' });
      }
    });
  }

  const rootDomain = 'bzseguridad.store';
  const showAvailable = result.status === 'available';
  const showUnavailable = result.status === 'unavailable';

  return (
    <div className="max-w-lg mx-auto">
      {/* Input pill + botón Comprobar */}
      <form
        onSubmit={(e) => { e.preventDefault(); check(); }}
        className="flex rounded-full border-2 border-neutral-900 bg-white overflow-hidden shadow-lg"
      >
        <input
          type="text"
          value={slug}
          onChange={(e) => {
            setSlug(normalize(e.target.value));
            if (result.status !== 'idle') setResult({ status: 'idle' });
          }}
          placeholder="miNegocio"
          className="flex-1 px-5 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none min-w-0"
          autoComplete="off"
          spellCheck={false}
        />
        <div className="hidden sm:flex items-center px-3 text-neutral-500 border-l border-neutral-200 bg-neutral-50 whitespace-nowrap">
          .{rootDomain}
        </div>
        <button
          type="submit"
          disabled={pending || !slug}
          className="bg-orange-500 text-white px-6 py-3 font-semibold hover:bg-orange-600 transition disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? '…' : 'Comprobar'}
        </button>
      </form>
      <div className="sm:hidden mt-2 text-center text-xs text-neutral-500">
        .{rootDomain}
      </div>

      {/* Feature pills */}
      {!showAvailable && !showUnavailable && (
        <div className="mt-4 text-xs text-neutral-600 flex flex-wrap gap-2 justify-center">
          <span className="rounded-full bg-white/80 backdrop-blur px-3 py-1 border border-orange-200">✓ SSL incluido</span>
          <span className="rounded-full bg-white/80 backdrop-blur px-3 py-1 border border-orange-200">✓ Dominio propio soportado</span>
          <span className="rounded-full bg-white/80 backdrop-blur px-3 py-1 border border-orange-200">✓ CDN global</span>
        </div>
      )}

      {/* Resultado: disponible */}
      {showAvailable && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-500 bg-white p-6 text-center shadow-lg">
          <div className="text-3xl mb-2">🎉</div>
          <div className="text-xs uppercase tracking-widest text-emerald-600 font-bold mb-1">Disponible</div>
          <div className="text-lg md:text-xl font-bold text-neutral-900 break-all">
            {result.slug}.{rootDomain}
          </div>
          <p className="text-sm text-neutral-600 mt-2 mb-4">
            está esperando por vos.
          </p>
          <Link
            href={`/signup?slug=${encodeURIComponent(result.slug)}`}
            className="inline-block rounded-full bg-neutral-900 text-white px-8 py-3 font-semibold hover:bg-neutral-800 transition"
          >
            Empezá ahora →
          </Link>
        </div>
      )}

      {/* Resultado: no disponible */}
      {showUnavailable && (
        <div className="mt-6 rounded-2xl border-2 border-rose-400 bg-white p-6 text-center shadow-lg">
          <div className="text-3xl mb-2">😕</div>
          <div className="text-xs uppercase tracking-widest text-rose-600 font-bold mb-1">
            {result.reason === 'taken' ? 'No disponible' : 'Ese nombre no sirve'}
          </div>
          {result.slug && (
            <div className="text-lg font-bold text-neutral-900 break-all">
              {result.slug}.{rootDomain}
            </div>
          )}
          <p className="text-sm text-neutral-600 mt-2">
            {REASON_MSG[result.reason] ?? REASON_MSG.taken}
          </p>
        </div>
      )}
    </div>
  );
}
