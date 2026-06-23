'use client';

import { useActionState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signupAction, type ActionResult } from '@/lib/auth/actions';

export function SignupForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(signupAction, null);

  useEffect(() => {
    if (state?.ok && state.redirectTo) {
      // window.location.href para soportar URLs absolutas a otros subdominios
      window.location.href = state.redirectTo;
    }
  }, [state]);

  if (state?.ok && state.message === 'check_email') {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">📧</div>
        <h2 className="text-2xl font-bold">Revisá tu email</h2>
        <p className="text-white/70">
          Te mandamos un link de confirmación. Hacé click ahí para activar tu cuenta y
          empezar a crear tu sitio.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="block text-sm mb-1.5 text-white/70" htmlFor="display_name">
          Tu nombre
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          placeholder="María Pérez"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
      </div>
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
          minLength={8}
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
          className="w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
        />
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-white text-black py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-white/50">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-white hover:underline">
          Iniciar sesión
        </Link>
      </p>
    </form>
  );
}
