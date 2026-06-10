'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { VARIANT_KEYS, type VariantKey, buildCourseUrl } from '@/lib/affiliates/url';

/**
 * Barra superior que aparece en TODO el storefront cuando el user logueado
 * es affiliate activo del tenant. Mientras navega:
 *  - En cualquier página: pill "Modo afiliado · Ir al panel"
 *  - En /c/<slug>: además del pill, switch A/B/C y botón Copiar link
 *    con su ?ref=<code> + ?v=<variant> embebido
 *
 * El código se fetchea client-side a /api/aff/my-code (lazy, solo cuando
 * caemos en una course page).
 */
export function AffiliateBar({
  primary, tenantSlug, tenantId
}: {
  primary: string; tenantSlug: string; tenantId: string;
}) {
  const pathname = usePathname() ?? '';
  const courseSlugMatch = pathname.match(/^\/c\/([^/]+)$/);
  const courseSlug = courseSlugMatch?.[1] ?? null;

  const [variant, setVariant] = useState<VariantKey>('A');
  const [refCode, setRefCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hidden, setHidden] = useState(false);

  function dismiss() {
    // Cookie 30 días scopeada al tenant. La layout lee la misma cookie y
    // ya no renderiza la barra en próximos navegaciones.
    const days = 30;
    document.cookie = `aff_bar_hidden_${tenantId}=1; path=/; max-age=${60 * 60 * 24 * days}; SameSite=Lax`;
    setHidden(true);
  }

  if (hidden) return null;

  // Fetch lazy del code cuando entramos a una course page
  useEffect(() => {
    if (!courseSlug) { setRefCode(null); return; }
    setRefCode(null); // reset mientras carga
    fetch(`/api/aff/my-code?slug=${encodeURIComponent(courseSlug)}&tenant=${encodeURIComponent(tenantSlug)}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { code?: string } | null) => { setRefCode(d?.code ?? null); })
      .catch(() => setRefCode(null));
  }, [courseSlug, tenantSlug]);

  const isLoading = courseSlug !== null && refCode === null;
  const fullLink = courseSlug && refCode
    ? buildCourseUrl({
        origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        courseSlug, ref: refCode, variant
      })
    : null;

  async function copyLink() {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard a veces no está disponible */ }
  }

  return (
    <div
      className="text-white px-4 py-2.5 text-sm flex flex-wrap items-center gap-3"
      style={{ background: `linear-gradient(90deg, ${primary} 0%, ${primary}dd 100%)` }}
    >
      <span className="font-semibold flex items-center gap-1.5">💼 Modo afiliado</span>

      {courseSlug && (
        <>
          <span className="text-white/80 text-xs">·</span>

          {/* Variant switcher */}
          <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
            {VARIANT_KEYS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                  variant === v ? 'bg-white text-black' : 'text-white/85 hover:bg-white/10'
                }`}
                title={v === 'A' ? 'Versión pública por default' : `Variante alternativa ${v}`}
              >
                {v === 'A' ? 'A · Default' : v}
              </button>
            ))}
          </div>

          {/* Copy link */}
          <button
            type="button"
            onClick={copyLink}
            disabled={!fullLink}
            className="text-xs rounded-full px-3 py-1 bg-white text-black font-semibold disabled:opacity-50 hover:bg-white/90"
          >
            {isLoading ? '…' : copied ? '✓ Copiado' : '📋 Copiar mi link'}
          </button>

          {fullLink && (
            <code className="text-[10px] text-white/75 truncate max-w-[280px]">
              {fullLink.replace(/^https?:\/\//, '')}
            </code>
          )}
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        <a
          href="/affiliate"
          className="text-xs rounded-full border border-white/30 px-3 py-1 hover:bg-white/10"
        >
          Ir al panel →
        </a>
        <button
          type="button"
          onClick={dismiss}
          title="Ocultar esta barra por 30 días"
          className="text-white/70 hover:text-white text-lg leading-none w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center"
          aria-label="Ocultar barra de afiliado"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
