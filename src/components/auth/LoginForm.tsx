'use client';

import { useActionState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginAction, type ActionResult } from '@/lib/auth/actions';

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);

  const urlError = params.get('error');
  const next = params.get('next');

  useEffect(() => {
    if (state?.ok) {
      router.push(next || state.redirectTo || '/onboarding');
    }
  }, [state, next, router]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
      </div>
      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
      </div>

      {(state?.ok === false || urlError) && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state?.ok === false ? state.error : urlError}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-white text-black py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50"
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>

      <p className="text-center text-sm text-white/50">
        ¿Todavía no tenés cuenta?{' '}
        <Link href="/signup" className="text-white hover:underline">
          Crear academia
        </Link>
      </p>
    </form>
  );
}
