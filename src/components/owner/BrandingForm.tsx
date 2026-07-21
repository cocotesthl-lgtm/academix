'use client';

import { useActionState, useState, useEffect } from 'react';
import { updateBrandingAction, type BrandingResult } from '@/lib/branding/actions';
import { showToast } from './ToastBus';
import { ThemePresets } from '@/components/shared/ThemePresets';

type Brand = {
  logo_url?: string | null;
  logo_text?: string | null;
  logo_layout?: 'square' | 'horizontal' | null;
  primary_color?: string;
  primary_gradient?: string | null;
  accent_color?: string;
  og_image_url?: string | null;
  tagline?: string | null;
};

export function BrandingForm({
  initialName,
  initialBrand,
  slug,
  rootDomain
}: {
  initialName: string;
  initialBrand: Brand;
  slug: string;
  rootDomain?: string;
}) {
  const [state, formAction, pending] = useActionState<BrandingResult | null, FormData>(
    updateBrandingAction,
    null
  );
  const [primary, setPrimary] = useState(initialBrand.primary_color ?? '#f97316');
  const [primaryGradient, setPrimaryGradient] = useState<string>(initialBrand.primary_gradient ?? '');
  const [accent, setAccent] = useState(initialBrand.accent_color ?? '#22d3ee');
  const [layout, setLayout] = useState<'square' | 'horizontal'>(
    initialBrand.logo_layout === 'horizontal' ? 'horizontal' : 'square'
  );
  const [logoUrl, setLogoUrl] = useState(initialBrand.logo_url ?? '');
  const [logoText, setLogoText] = useState(initialBrand.logo_text ?? '');
  const [ogImageUrl, setOgImageUrl] = useState(initialBrand.og_image_url ?? '');
  const [tagline, setTagline] = useState(initialBrand.tagline ?? '');

  const domain = rootDomain ?? 'bzseguridad.store';

  useEffect(() => {
    if (!state) return;
    if (state.ok) showToast('Branding actualizado', 'success');
    else showToast(state.error, 'error', 4500);
  }, [state]);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Nombre de el sitio</label>
        <input
          name="name"
          required
          defaultValue={initialName}
          maxLength={80}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
        <p className="text-xs text-white/40 mt-1">Subdominio actual: {slug}.{domain}</p>
      </div>

      {/* Logo layout selector */}
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Tipo de logo</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLayout('square')}
            className={`rounded-md border px-3 py-2 text-sm text-left ${
              layout === 'square'
                ? 'border-white bg-white/10 text-white'
                : 'border-white/15 text-white/60 hover:border-white/30'
            }`}
          >
            <div className="font-medium">Cuadrado (isotipo)</div>
            <div className="text-xs text-white/50 mt-0.5">Imagen 1:1 + texto opcional al lado</div>
          </button>
          <button
            type="button"
            onClick={() => setLayout('horizontal')}
            className={`rounded-md border px-3 py-2 text-sm text-left ${
              layout === 'horizontal'
                ? 'border-white bg-white/10 text-white'
                : 'border-white/15 text-white/60 hover:border-white/30'
            }`}
          >
            <div className="font-medium">Horizontal (imagotipo)</div>
            <div className="text-xs text-white/50 mt-0.5">Solo imagen alargada, sin texto</div>
          </button>
        </div>
        <input type="hidden" name="logo_layout" value={layout} />
      </div>

      {/* Logo URL */}
      <div>
        <label className="block text-sm mb-1.5 text-white/70">URL del logo</label>
        <div className="flex items-start gap-3">
          <div
            className={`shrink-0 rounded-lg bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden ${
              layout === 'horizontal' ? 'w-40 h-14' : 'w-20 h-20'
            }`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-white/40">sin logo</span>
            )}
          </div>
          <div className="flex-1">
            <input
              type="url"
              name="logo_url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://… (pegá la URL pública de la imagen)"
              className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
            />
            <p className="text-xs text-white/50 mt-1">
              📐 Recomendado:{' '}
              {layout === 'horizontal'
                ? '480×120px (4:1), PNG con fondo transparente'
                : '256×256px (1:1), PNG con fondo transparente'}
            </p>
          </div>
        </div>
      </div>

      {/* Logo text (solo cuadrado) */}
      {layout === 'square' && (
        <div>
          <label className="block text-sm mb-1.5 text-white/70">
            Texto al lado del logo <span className="text-white/40">(opcional)</span>
          </label>
          <input
            type="text"
            name="logo_text"
            value={logoText}
            onChange={(e) => setLogoText(e.target.value)}
            maxLength={40}
            placeholder="Ej: Sitio Bz"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <p className="text-xs text-white/40 mt-1">
            Si lo dejás vacío, solo se muestra el isotipo cuadrado.
          </p>
        </div>
      )}
      {layout === 'horizontal' && (
        // Mantenemos el campo igual presente (vacío) para evitar perder el valor previo silenciosamente
        <input type="hidden" name="logo_text" value="" />
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 text-white/70">
            Color primario {primaryGradient && <span className="text-emerald-400 text-xs">· gradient activo</span>}
          </label>
          <div className="flex items-center gap-2">
            {primaryGradient ? (
              <div
                className="w-12 h-10 rounded-md border border-white/15"
                style={{ background: primaryGradient }}
                title="Gradient activo — click ✕ para volver al sólido"
              />
            ) : (
              <input
                name="primary_color"
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="w-12 h-10 rounded-md bg-transparent border border-white/15 cursor-pointer"
              />
            )}
            {/* Siempre enviamos el hex — primary_gradient viaja aparte
                para que el fallback funcione en cualquier lugar que no
                soporte gradient CSS (SVG stroke, alpha mixing, íconos). */}
            {primaryGradient && <input type="hidden" name="primary_color" value={primary} />}
            <input type="hidden" name="primary_gradient" value={primaryGradient} />
            <span className="text-sm text-white/60 font-mono">
              {primaryGradient ? 'gradient' : primary}
            </span>
            {primaryGradient && (
              <button type="button" onClick={() => setPrimaryGradient('')}
                className="text-xs text-white/50 hover:text-red-300 underline">
                quitar
              </button>
            )}
          </div>
          <div className="mt-2 p-2 rounded border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Temas rápidos</div>
            <ThemePresets mode="all" currentValue={primaryGradient || primary} compact
              onPick={(hex, grad) => {
                setPrimary(hex);
                setPrimaryGradient(grad || '');
              }} />
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Color acento</label>
          <div className="flex items-center gap-2">
            <input
              name="accent_color"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="w-12 h-10 rounded-md bg-transparent border border-white/15 cursor-pointer"
            />
            <span className="text-sm text-white/60 font-mono">{accent}</span>
          </div>
          <div className="mt-2 p-2 rounded border border-white/10 bg-white/[0.02]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1.5">Temas rápidos</div>
            <ThemePresets mode="solids" currentValue={accent} compact
              onPick={(hex) => setAccent(hex)} />
          </div>
        </div>
      </div>

      {/* SEO / compartir en redes */}
      <div className="rounded-xl border border-white/10 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white/85">SEO y compartir en redes</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Lo que aparece cuando alguien busca tu sitio en Google o comparte un link en WhatsApp / Twitter / Facebook.
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1.5 text-white/70">
            Tagline <span className="text-white/40">(frase corta)</span>
          </label>
          <input
            type="text"
            name="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            maxLength={80}
            placeholder="Ej: Cursos de inglés online para adultos"
            className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <p className="text-xs text-white/40 mt-1">
            Se agrega al título de tu sitio en Google. Ideal 40-60 caracteres. ({tagline.length}/80)
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1.5 text-white/70">
            Imagen para compartir <span className="text-white/40">(1200×630 px)</span>
          </label>
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-md bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden w-40 h-[84px]">
              {ogImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ogImageUrl} alt="og" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-white/40 text-center px-2">sin imagen<br />(no aparece foto al compartir)</span>
              )}
            </div>
            <div className="flex-1">
              <input
                type="url"
                name="og_image_url"
                value={ogImageUrl}
                onChange={(e) => setOgImageUrl(e.target.value)}
                placeholder="https://… (URL de imagen 1200×630)"
                className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
              />
              <p className="text-xs text-white/50 mt-1">
                📐 Exactamente <strong>1200×630 px</strong> (ratio 1.91:1). Es lo que exigen WhatsApp / Twitter / Facebook.
                Si dejás vacío, se comparte el link sin foto — mejor eso que una foto cortada.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-white/10 p-4">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Vista previa</p>
        <div className="flex items-center gap-3 mb-4">
          {layout === 'square' ? (
            <>
              <div className="w-10 h-10 rounded-md bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-[10px] text-white/40">logo</span>
                )}
              </div>
              {logoText && <span className="font-semibold text-white">{logoText}</span>}
            </>
          ) : (
            <div className="h-10 w-auto max-w-[200px] bg-white/5 border border-white/15 rounded-md px-2 flex items-center overflow-hidden">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-auto object-contain" />
              ) : (
                <span className="text-[10px] text-white/40">logo horizontal</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md px-4 py-2 font-medium text-white"
            style={{ background: primary }}
          >
            Comprar publicación
          </button>
          <button
            type="button"
            className="rounded-md px-4 py-2 font-medium"
            style={{ border: `1px solid ${accent}`, color: accent }}
          >
            Ver más
          </button>
        </div>
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}
      {state?.ok && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm px-3 py-2">
          Cambios guardados.
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-white text-black px-6 py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
