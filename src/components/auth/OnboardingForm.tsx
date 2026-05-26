'use client';

import { useActionState, useEffect, useState } from 'react';
import { createTenantAction, type OnboardingResult } from '@/lib/tenant/actions';

export function OnboardingForm({ rootDomain }: { rootDomain: string }) {
  const [state, formAction, pending] = useActionState<OnboardingResult | null, FormData>(createTenantAction, null);
  const [slug, setSlug] = useState('');

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      window.location.href = state.redirectTo;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="name">
          Nombre de tu academia
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={80}
          placeholder="Academia de Diseño UX"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
      </div>

      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="slug">
          Subdominio
        </label>
        <div className="flex rounded-md overflow-hidden border border-white/15 focus-within:border-white/40">
          <input
            id="slug"
            name="slug"
            required
            minLength={3}
            maxLength={32}
            pattern="^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="miacademia"
            className="flex-1 bg-white/5 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none"
          />
          <span className="bg-white/[0.02] text-white/50 px-3 py-2.5 text-sm border-l border-white/15">
            .{rootDomain}
          </span>
        </div>
        {slug && (
          <p className="text-xs text-white/50 mt-1.5">
            Tu academia va a estar en <span className="text-white">{slug}.{rootDomain}</span>
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
            defaultValue="#a855f7"
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
        {pending ? 'Creando tu academia…' : 'Crear academia'}
      </button>
    </form>
  );
}
