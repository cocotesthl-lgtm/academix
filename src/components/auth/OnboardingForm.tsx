'use client';

import { useActionState, useEffect, useState } from 'react';
import { createTenantAction, type OnboardingResult } from '@/lib/tenant/actions';

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

export function OnboardingForm({ rootDomain }: { rootDomain: string }) {
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(createTenantAction, null);
  const [name, setName] = useState('');
  const slug = slugify(name);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="name">
          Nombre de tu sitio
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mi Academia de Diseño"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
        {/* El subdominio se auto-deriva del nombre. El owner siempre puede
            cambiarlo después desde el panel. */}
        <input type="hidden" name="slug" value={slug} />
        {slug && slug.length >= 3 && (
          <p className="text-xs text-white/50 mt-1.5">
            Tu sitio va a estar en <span className="text-white">{slug}.{rootDomain}</span>
            <span className="text-white/35"> (podés cambiar el dominio después)</span>
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="primary_color">
          Color principal de marca
        </label>
        <div className="flex gap-3 items-center">
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            defaultValue="#f97316"
            className="w-14 h-11 rounded-md bg-transparent border border-white/15 cursor-pointer"
          />
          <span className="text-sm text-white/50">Lo podés cambiar después en branding.</span>
        </div>
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-white text-black py-3 font-semibold hover:bg-white/90 transition disabled:opacity-50"
      >
        {pending ? 'Creando tu sitio…' : 'Crear sitio'}
      </button>
    </form>
  );
}
