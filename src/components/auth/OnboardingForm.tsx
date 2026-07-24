'use client';

import { useActionState, useEffect, useState } from 'react';
import { createTenantAction, type OnboardingResult } from '@/lib/tenant/actions';
import { SITE_TEMPLATES } from '@/lib/site/templates/catalog';
import { ThemePresets } from '@/components/shared/ThemePresets';

/** Slugifica el nombre de un sitio para usarlo como subdominio:
 *  pasa a lowercase, saca acentos, reemplaza espacios por guiones,
 *  remueve cualquier char no permitido. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

/**
 * OnboardingForm — form del wizard de creación de sitio.
 *
 * En desktop se renderea en un layout 2-col con el preview iframe a la
 * derecha (ver /(auth)/onboarding/page.tsx). En mobile queda columna
 * única y el preview se abre en pestaña nueva desde el link "Ver preview".
 *
 * Props:
 *  · rootDomain — dominio raíz para armar el slug preview
 *  · onTemplateChange — callback opcional para que el parent muestre el
 *    preview del template elegido. Emitimos '' para "empezar en blanco".
 */
export function OnboardingForm({
  rootDomain,
  onTemplateChange,
  onColorChange,
  onGradientChange
}: {
  rootDomain: string;
  onTemplateChange?: (templateId: string) => void;
  /** Emite el color primario elegido para que el parent lo pinte en el preview. */
  onColorChange?: (color: string) => void;
  /** Emite el gradient CSS elegido ('' si no hay gradient) — para propagar
   *  al iframe del preview vía query param. */
  onGradientChange?: (gradient: string) => void;
}) {
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(createTenantAction, null);
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('');
  const [primaryColor, setPrimaryColor] = useState<string>('#f97316');
  const [primaryGradient, setPrimaryGradient] = useState<string>('');
  const slug = slugify(name);
  const chosenTemplate = SITE_TEMPLATES.find((t) => t.id === templateId);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  // Notificar al parent cada vez que cambia el template para actualizar el preview.
  useEffect(() => {
    onTemplateChange?.(templateId);
  }, [templateId, onTemplateChange]);

  // Idem con el color primario. El parent debounce-a los updates antes de
  // recargar el iframe para evitar flicker cuando arrastrás el picker.
  useEffect(() => {
    onColorChange?.(primaryColor);
  }, [primaryColor, onColorChange]);

  useEffect(() => {
    onGradientChange?.(primaryGradient);
  }, [primaryGradient, onGradientChange]);

  // Cuando elegís template, sugerimos su color primario si no lo cambiaste manualmente
  function selectTemplate(id: string) {
    setTemplateId(id);
    const t = SITE_TEMPLATES.find((x) => x.id === id);
    if (t?.suggestedPrimary) setPrimaryColor(t.suggestedPrimary);
  }

  return (
    <form action={formAction} className="space-y-8">
      {/* Paso 1: Nombre */}
      <div>
        <label className="block text-sm mb-1.5 text-neutral-700 font-semibold" htmlFor="name">
          1. ¿Cómo se llama tu sitio?
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. La Voz del Barrio, Deco Norte, Cursos Ana"
          className="w-full rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
        />
        <input type="hidden" name="slug" value={slug} />
        {slug && slug.length >= 3 && (
          <p className="text-xs text-neutral-500 mt-1.5">
            Tu sitio va a estar en <span className="font-mono text-neutral-900">{slug}.{rootDomain}</span>
          </p>
        )}
      </div>

      {/* Paso 2: Color principal de marca (subido de posición) */}
      <div>
        <label className="block text-sm mb-1.5 text-neutral-700 font-semibold" htmlFor="primary_color">
          2. Color principal de marca
        </label>
        <div className="flex gap-3 items-center">
          {primaryGradient ? (
            <>
              <div className="w-14 h-11 rounded-md border border-neutral-300"
                style={{ background: primaryGradient }}
                title="Gradient elegido" />
              <input type="hidden" name="primary_color" value={primaryColor} />
              <button type="button" onClick={() => setPrimaryGradient('')}
                className="text-xs text-neutral-500 hover:text-red-600 underline">
                usar color sólido
              </button>
            </>
          ) : (
            <input
              id="primary_color"
              name="primary_color"
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-14 h-11 rounded-md bg-transparent border border-neutral-300 cursor-pointer"
            />
          )}
          <input type="hidden" name="primary_gradient" value={primaryGradient} />
          {!primaryGradient && (
            <span className="text-sm text-neutral-500">
              {chosenTemplate ? 'Sugerido por el template — cambialo si querés.' : 'Lo podés cambiar después en Identidad.'}
            </span>
          )}
        </div>
        {/* Presets curados — atajo rápido para no tener que abrir la
            rueda de colores del OS y elegir a ojo. */}
        <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2 font-semibold">
            O elegí un tema pre-armado
          </div>
          <ThemePresets mode="all" theme="light" currentValue={primaryGradient || primaryColor} compact
            onPick={(hex, grad) => {
              setPrimaryColor(hex);
              setPrimaryGradient(grad || '');
            }} />
        </div>
      </div>

      {/* Paso 3: Template picker */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <label className="block text-sm text-neutral-700 font-semibold">
            3. Elegí un template para arrancar
          </label>
          <span className="text-xs text-neutral-500">Podés cambiar todo después.</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Opción 'Empezar en blanco' */}
          <button
            type="button"
            onClick={() => setTemplateId('')}
            className={`text-left rounded-xl border-2 p-4 transition ${
              templateId === ''
                ? 'border-neutral-900 bg-neutral-50'
                : 'border-neutral-200 bg-white hover:border-neutral-400'
            }`}
          >
            <div className="text-2xl mb-2">✨</div>
            <div className="font-semibold text-sm">Empezar en blanco</div>
            <div className="text-xs text-neutral-500 mt-1">
              Base neutra con hero + secciones estándar. Editás todo desde el builder.
            </div>
          </button>

          {(() => {
            // En onboarding mostramos SOLO 1 template por categoría (el
            // primero declarado). Los themes/variantes se eligen después
            // desde /owner/templates con el flow de 2 pasos (categoría →
            // theme). Sino mezclábamos "Estudio profesional" con "Esmerald"
            // al mismo nivel y confundía — una es categoría, la otra un
            // theme dentro de Gastronomía.
            const seen = new Set<string>();
            return SITE_TEMPLATES.filter((t) => {
              if (seen.has(t.category)) return false;
              seen.add(t.category);
              return true;
            });
          })().map((t) => {
            const selected = templateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t.id)}
                className={`text-left rounded-xl border-2 p-4 transition ${
                  selected
                    ? 'border-neutral-900 bg-neutral-50'
                    : 'border-neutral-200 bg-white hover:border-neutral-400'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-2xl">{t.emoji}</div>
                  <div className="w-6 h-6 rounded-full border-2"
                    style={{
                      background: t.suggestedPrimary,
                      borderColor: t.suggestedPrimary
                    }}
                    title={t.suggestedPrimary}
                  />
                </div>
                <div className="font-semibold text-sm">{t.name}</div>
                <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{t.shortDesc}</div>
                {/* Solo mobile: link a preview en nueva pestaña. En desktop
                    la preview vive en el panel a la derecha (ver page.tsx). */}
                <a
                  href={`/preview/${t.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="lg:hidden inline-block mt-3 text-xs text-orange-600 font-semibold hover:underline"
                >
                  Ver preview →
                </a>
              </button>
            );
          })}
        </div>

        <input type="hidden" name="template_id" value={templateId} />

        {chosenTemplate && (
          <div className="mt-3 text-xs text-neutral-500">
            <strong className="text-neutral-900">Elegiste:</strong> {chosenTemplate.name} — categoría: {chosenTemplate.category}
          </div>
        )}
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      {/*
        Botón submit fijado abajo-derecha en desktop (FAB style).
        En mobile queda en su lugar habitual bajo el form. Padding extra
        en el bottom del form para que el contenido no quede tapado.
      */}
      <div className="h-6" aria-hidden="true" />

      <div className="fixed bottom-6 right-6 z-50 hidden sm:block">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-neutral-900 text-white px-7 py-3.5 font-semibold hover:bg-neutral-800 transition shadow-2xl disabled:opacity-50 whitespace-nowrap"
        >
          {pending ? 'Creando tu sitio…' : 'Crear mi sitio →'}
        </button>
      </div>

      {/* Mobile: submit inline (el fixed en pantallas chicas tapa contenido) */}
      <button
        type="submit"
        disabled={pending}
        className="sm:hidden w-full rounded-md bg-neutral-900 text-white py-3 font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
      >
        {pending ? 'Creando tu sitio…' : 'Crear mi sitio →'}
      </button>
    </form>
  );
}
