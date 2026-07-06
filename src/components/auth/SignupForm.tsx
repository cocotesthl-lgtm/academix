'use client';

import { useActionState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signupAction, type ActionResult } from '@/lib/auth/actions';
import { GoogleAuthButton } from './GoogleAuthButton';
import { GoogleOneTapButton } from './GoogleOneTapButton';

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
        <p className="text-neutral-600">
          Te mandamos un link de confirmación. Hacé click ahí para activar tu cuenta y
          empezar a crear tu sitio.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        ? <GoogleOneTapButton theme="light" next={next || undefined} />
        : <GoogleAuthButton theme="light" next={next || undefined} label="Registrarme con Google" />}
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider">
        <div className="flex-1 h-px bg-neutral-200" />
        <span className="text-neutral-400">o con email</span>
        <div className="flex-1 h-px bg-neutral-200" />
      </div>
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {/* Nombre eliminado para reducir fricción. El name del user se deriva
          del email o del nombre del sitio en el onboarding. */}
      <div>
        <label className="block text-sm mb-1.5 text-neutral-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          className="w-full rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
        />
      </div>
      <div>
        <label className="block text-sm mb-1.5 text-neutral-700" htmlFor="password">
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
          className="w-full rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900"
        />
      </div>

      {state?.ok === false && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 text-white py-2.5 font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm text-neutral-600">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" className="text-neutral-900 hover:underline font-medium">
          Iniciar sesión
        </Link>
      </p>
    </form>
    </div>
  );
}
