'use client';

import { useActionState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginAction, type ActionResult } from '@/lib/auth/actions';

/**
 * LoginForm reutilizable. Por defecto se renderiza con tema oscuro (para
 * el login global de Curplat). En el storefront pasamos theme='light' y
 * un primaryColor para que matchee con el branding del owner.
 */
export function LoginForm({
  theme = 'dark',
  hideCreateAccount = false,
  primaryColor
}: {
  theme?: 'dark' | 'light';
  hideCreateAccount?: boolean;
  primaryColor?: string;
} = {}) {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);

  const urlError = params.get('error');
  const next = params.get('next');

  useEffect(() => {
    if (state?.ok) {
      // Use window.location.href so absolute cross-subdomain URLs work
      // (router.push won't navigate cross-origin).
      window.location.href = next || state.redirectTo || '/onboarding';
    }
  }, [state, next]);

  const isLight = theme === 'light';

  const labelCls = isLight ? 'block text-sm mb-1.5 text-black/70' : 'block text-sm mb-1.5 text-white/70';
  const inputCls = isLight
    ? 'w-full rounded-md bg-white border border-black/15 px-3 py-2.5 text-black placeholder:text-black/30 focus:outline-none focus:border-black/40'
    : 'w-full rounded-md bg-white/5 border border-white/15 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40';
  const errCls = isLight
    ? 'rounded-md bg-red-100 border border-red-300 text-red-700 text-sm px-3 py-2'
    : 'rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm px-3 py-2';
  const linkCls = isLight ? 'text-black hover:underline' : 'text-white hover:underline';
  const linkParaCls = isLight ? 'text-center text-sm text-black/60' : 'text-center text-sm text-white/50';

  const buttonStyle = isLight && primaryColor
    ? { background: primaryColor, color: '#fff' }
    : undefined;
  const buttonCls = isLight
    ? 'w-full rounded-md py-2.5 font-semibold transition disabled:opacity-50'
    : 'w-full rounded-md bg-white text-black py-2.5 font-semibold hover:bg-white/90 transition disabled:opacity-50';

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelCls} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="vos@ejemplo.com"
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls} htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>

      {(state?.ok === false || urlError) && (
        <div className={errCls}>
          {state?.ok === false ? state.error : urlError}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonCls}
        style={buttonStyle}
      >
        {pending ? 'Ingresando…' : 'Ingresar'}
      </button>

      {!hideCreateAccount && (
        <p className={linkParaCls}>
          ¿Todavía no tenés cuenta?{' '}
          <Link href="/signup" className={linkCls}>
            Crear academia
          </Link>
        </p>
      )}
    </form>
  );
}
