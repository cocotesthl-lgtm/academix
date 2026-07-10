'use client';

import { useEffect, useState } from 'react';
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
  const [color, setColor] = useState<string>('');
  const [debouncedColor, setDebouncedColor] = useState<string>('');
  const chosen = SITE_TEMPLATES.find((t) => t.id === templateId);

  // Debounce del color: recargar el iframe en cada onChange del color picker
  // haría flicker feo al arrastrar. Esperamos 400ms sin cambios antes de
  // propagar el color a la src del iframe.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedColor(color), 400);
    return () => clearTimeout(t);
  }, [color]);

  // Armamos la src del iframe con el color como query param. El componente
  // de preview lo lee y overridea el suggestedPrimary del template.
  // Encode con encodeURIComponent porque el color trae # (ej. #f97316).
  function previewSrc(id: string): string {
    const base = `/preview/${id}?embedded=1`;
    if (!debouncedColor) return base;
    return `${base}&primary=${encodeURIComponent(debouncedColor)}`;
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
          <OnboardingForm
            rootDomain={rootDomain}
            onTemplateChange={setTemplateId}
            onColorChange={setColor}
          />
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
              <iframe
                key={chosen.id}
                src={previewSrc(chosen.id)}
                title={`Preview de ${chosen.name}`}
                className="absolute inset-0 w-full h-full"
              />
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
