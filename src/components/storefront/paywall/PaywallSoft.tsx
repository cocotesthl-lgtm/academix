'use client';

import { useEffect, useState } from 'react';

/**
 * Paywall SOFT: recibe el resto del artículo pre-renderizado como HTML
 * y muestra un banner que lo tapa con gradient + CTA. Al hacer click
 * en "Seguir leyendo igual", persiste la decisión en localStorage y
 * revela el resto — para que el usuario no tenga que dismissear en
 * cada nota.
 *
 * El HTML del resto siempre se renderiza en el DOM (view-source lo
 * expone). Es un paywall recomendatorio, no seguridad — es lo que se
 * espera del modo "opcional".
 */
export function PaywallSoft({
  restHtml,
  title,
  message,
  ctaLabel,
  ctaHref,
  dismissLabel,
  primaryColor
}: {
  restHtml: string;
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  dismissLabel: string;
  primaryColor: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window !== 'undefined' && window.localStorage.getItem('paywall-soft-dismissed') === '1') {
      setDismissed(true);
    }
  }, []);

  function handleDismiss() {
    try { window.localStorage.setItem('paywall-soft-dismissed', '1'); } catch { /* ignore */ }
    setDismissed(true);
  }

  // Pre-hidratación: rendereamos el CTA (SSR-safe) para que Google
  // vea el paywall como señal + para que un usuario sin JS no lo
  // pueda esquivar accidentalmente.
  if (!hydrated || !dismissed) {
    return (
      <div className="relative">
        {/* Preview borroneado del resto — pura señal visual */}
        <div className="relative overflow-hidden max-h-40">
          <div
            className="prose prose-lg max-w-none opacity-60 blur-[2px] select-none pointer-events-none"
            dangerouslySetInnerHTML={{ __html: restHtml }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/60 to-white" />
        </div>

        {/* CTA card */}
        <div className="border-2 rounded-lg p-6 md:p-8 mt-4 shadow-lg"
          style={{ borderColor: primaryColor, background: `${primaryColor}10` }}>
          <div className="text-center max-w-xl mx-auto">
            <div className="text-xs uppercase tracking-widest font-bold mb-2" style={{ color: primaryColor }}>
              📖 Contenido exclusivo
            </div>
            <h3 className="font-serif text-2xl md:text-3xl font-bold mb-3">{title}</h3>
            <p className="text-black/70 mb-5">{message}</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
              <a href={ctaHref}
                className="inline-block px-6 py-3 rounded font-semibold text-white transition hover:opacity-90"
                style={{ background: primaryColor }}>
                {ctaLabel}
              </a>
              <button type="button" onClick={handleDismiss}
                className="text-sm text-black/60 hover:text-black underline">
                {dismissLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dismissed: mostrar el resto real
  return (
    <div className="prose prose-lg max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-a:underline"
      dangerouslySetInnerHTML={{ __html: restHtml }}
    />
  );
}
