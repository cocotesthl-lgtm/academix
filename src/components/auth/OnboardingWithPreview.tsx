'use client';

import { useRef, useState } from 'react';
import { OnboardingForm } from './OnboardingForm';
import { SITE_TEMPLATES } from '@/lib/site/templates/catalog';

/**
 * Wrapper client del onboarding para mostrar la preview del template
 * seleccionado a la DERECHA del form (solo desktop lg+).
 *
 * · Form en la columna izquierda (~max 520px)
 * · Panel derecho con iframe de /preview/[id] del template elegido
 * · Cuando el user cambia de template, el iframe se actualiza en vivo
 * · "Empezar en blanco" (templateId='') muestra un estado vacío
 * · En mobile no se renderea el panel — el link "Ver preview →" del
 *   OnboardingForm sigue abriendo en pestaña nueva
 */
export function OnboardingWithPreview({ rootDomain }: { rootDomain: string }) {
  const [templateId, setTemplateId] = useState<string>('');
  const chosen = SITE_TEMPLATES.find((t) => t.id === templateId);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  /**
   * Scroll dentro del iframe. Solo funciona same-origin — como el preview
   * vive en el MISMO dominio (app.<host>/preview/[id]), tenemos acceso al
   * contentWindow y podemos scrollear. Los botones son la "barra de
   * navegación para subir/bajar" que pide el user cuando el trackpad no
   * funciona bien sobre el iframe.
   */
  function scrollPreview(dir: 'up' | 'down' | 'top' | 'bottom') {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const step = win.innerHeight * 0.8;
    if (dir === 'up') win.scrollBy({ top: -step, behavior: 'smooth' });
    else if (dir === 'down') win.scrollBy({ top: step, behavior: 'smooth' });
    else if (dir === 'top') win.scrollTo({ top: 0, behavior: 'smooth' });
    else win.scrollTo({ top: win.document.body.scrollHeight, behavior: 'smooth' });
  }

  return (
    <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,520px)_1fr] gap-8">
      {/* Columna izquierda: form */}
      <div className="space-y-8">
        <div>
          <a href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </a>
          <h1 className="mt-6 text-3xl font-bold text-neutral-900">Configurá tu sitio</h1>
          <p className="mt-2 text-neutral-600">Estos datos los podés cambiar después.</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <OnboardingForm rootDomain={rootDomain} onTemplateChange={setTemplateId} />
        </div>
      </div>

      {/* Columna derecha: preview (solo desktop) */}
      <div className="hidden lg:block sticky top-6 self-start">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
            <div className="flex items-center gap-2 min-w-0">
              {chosen ? (
                <>
                  <span className="text-lg leading-none">{chosen.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{chosen.name}</div>
                    <div className="text-[11px] text-neutral-500 truncate">{chosen.category}</div>
                  </div>
                </>
              ) : (
                <>
                  <span className="text-lg leading-none">👀</span>
                  <div className="font-semibold text-sm">Preview del template</div>
                </>
              )}
            </div>
            {chosen && (
              <a
                href={`/preview/${chosen.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-orange-600 font-semibold hover:underline shrink-0"
              >
                Abrir en nueva pestaña ↗
              </a>
            )}
          </div>
          <div className="relative bg-neutral-100" style={{ height: 'calc(100vh - 160px)', minHeight: 500 }}>
            {chosen ? (
              <>
                <iframe
                  ref={iframeRef}
                  key={chosen.id}
                  src={`/preview/${chosen.id}`}
                  title={`Preview de ${chosen.name}`}
                  className="absolute inset-0 w-full h-full"
                />

                {/* Barra flotante de navegación vertical: subir/bajar por
                    página completa + ir al principio/final. Se apoya sobre
                    el borde derecho del iframe. */}
                <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
                  <button
                    type="button"
                    onClick={() => scrollPreview('top')}
                    className="w-9 h-9 rounded-full bg-white/95 border border-neutral-200 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white hover:text-black hover:shadow-lg transition"
                    aria-label="Ir arriba"
                    title="Ir arriba"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                      <line x1="6" y1="19" x2="18" y2="19" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollPreview('up')}
                    className="w-9 h-9 rounded-full bg-white/95 border border-neutral-200 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white hover:text-black hover:shadow-lg transition"
                    aria-label="Subir"
                    title="Subir"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="18 15 12 9 6 15" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollPreview('down')}
                    className="w-9 h-9 rounded-full bg-white/95 border border-neutral-200 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white hover:text-black hover:shadow-lg transition"
                    aria-label="Bajar"
                    title="Bajar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollPreview('bottom')}
                    className="w-9 h-9 rounded-full bg-white/95 border border-neutral-200 shadow-md flex items-center justify-center text-neutral-700 hover:bg-white hover:text-black hover:shadow-lg transition"
                    aria-label="Ir al final"
                    title="Ir al final"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                      <line x1="6" y1="5" x2="18" y2="5" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-center p-8">
                <div>
                  <div className="text-5xl mb-3">👈</div>
                  <div className="text-sm font-semibold text-neutral-700">Elegí un template a la izquierda</div>
                  <p className="text-xs text-neutral-500 mt-1">
                    Vas a ver cómo queda tu sitio antes de crearlo.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
