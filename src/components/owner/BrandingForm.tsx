'use client';

import { useActionState, useRef, useState } from 'react';
import { updateBrandingAction, type BrandingResult } from '@/lib/branding/actions';

type Brand = { logo_url?: string; primary_color?: string; accent_color?: string };

export function BrandingForm({
  initialName,
  initialBrand,
  slug
}: {
  initialName: string;
  initialBrand: Brand;
  slug: string;
}) {
  const [state, formAction, pending] = useActionState<BrandingResult | null, FormData>(
    updateBrandingAction,
    null
  );
  const [primary, setPrimary] = useState(initialBrand.primary_color ?? '#a855f7');
  const [accent, setAccent] = useState(initialBrand.accent_color ?? '#22d3ee');
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialBrand.logo_url ?? null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setLogoPreview(URL.createObjectURL(f));
  }

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <div>
        <label className="block text-sm mb-1.5 text-white/70">Nombre de la academia</label>
        <input
          name="name"
          required
          defaultValue={initialName}
          maxLength={80}
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 focus:outline-none focus:border-white/40"
        />
        <p className="text-xs text-white/40 mt-1">Subdominio actual: {slug}.curplat.com</p>
      </div>

      <div>
        <label className="block text-sm mb-1.5 text-white/70">Logo</label>
        <div className="flex items-center gap-4">
          <div
            className="w-20 h-20 rounded-lg bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden"
            style={{ background: logoPreview ? 'transparent' : undefined }}
          >
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <span className="text-xs text-white/40">sin logo</span>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={onFileChange}
              className="block text-sm text-white/70 file:mr-3 file:rounded-md file:border-0 file:bg-white file:text-black file:px-3 file:py-1.5 file:font-medium hover:file:bg-white/90"
            />
            <p className="text-xs text-white/40 mt-1">PNG, JPG, WebP o SVG. Hasta 2 MB.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1.5 text-white/70">Color primario</label>
          <div className="flex items-center gap-2">
            <input
              name="primary_color"
              type="color"
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              className="w-12 h-10 rounded-md bg-transparent border border-white/15 cursor-pointer"
            />
            <span className="text-sm text-white/60 font-mono">{primary}</span>
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
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-white/10 p-4">
        <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Vista previa</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-md px-4 py-2 font-medium text-white"
            style={{ background: primary }}
          >
            Comprar curso
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
