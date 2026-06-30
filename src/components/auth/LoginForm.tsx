'use client';

import { useActionState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { loginAction, type ActionResult } from '@/lib/auth/actions';
import { GoogleAuthButton } from './GoogleAuthButton';

/**
 * LoginForm reutilizable. Por defecto se renderiza con tema oscuro (para
 * el login global de Curplat). En el storefront pasamos theme='light' y
 * un primaryColor para que matchee con el branding del owner.
 */
export function LoginForm({
  theme = 'dark',
  hideCreateAccount = false,
  primaryColor,
  fallbackRedirect = '/onboarding'
}: {
  theme?: 'dark' | 'light';
  hideCreateAccount?: boolean;
  primaryColor?: string;
  /** Default si no hay next ni redirectTo. Usar '/learn' en storefronts. */
  fallbackRedirect?: string;
} = {}) {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(loginAction, null);

  const urlError = params.get('error');
  const next = params.get('next');

  useEffect(() => {
    if (state?.ok) {
      // Use window.location.href so absolute cross-subdomain URLs work
      // (router.push won't navigate cross-origin).
      window.location.href = next || state.redirectTo || fallbackRedirect;
    }
  }, [state, next, fallbackRedirect]);

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
    <div className="space-y-4">
      {/* Login con Google (OAuth via Supabase) */}
      <GoogleAuthButton theme={theme} next={next ?? undefined} />
      <div className="flex items-center gap-3 text-xs uppercase tracking-wider">
        <div className={`flex-1 h-px ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
        <span className={isLight ? 'text-black/40' : 'text-white/40'}>o con email</span>
        <div className={`flex-1 h-px ${isLight ? 'bg-black/10' : 'bg-white/10'}`} />
      </div>
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
          <Link
            href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
            className={linkCls}
          >
            {next?.startsWith('/affiliate') ? 'Registrarme como afiliado' : 'Crear sitio'}
          </Link>
        </p>
      )}
    </form>
    </div>
  );
}
