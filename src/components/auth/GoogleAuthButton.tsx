'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Botón "Continuar con Google" (OAuth via Supabase).
 *
 * Requiere setup one-time:
 *  1. Google Cloud Console → crear OAuth Client ID (web app)
 *  2. Authorized redirect URI: https://<project>.supabase.co/auth/v1/callback
 *  3. Supabase dashboard → Auth → Providers → Google → pegar Client ID + Secret
 *
 * Si no está configurado, Supabase devuelve error y mostramos un mensaje claro.
 */
export function GoogleAuthButton({
  theme = 'dark',
  label = 'Continuar con Google',
  next
}: {
  theme?: 'dark' | 'light';
  label?: string;
  next?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const isLight = theme === 'light';

  async function handleClick() {
    setLoading(true);
    setErr(null);
    try {
      const supabase = createSupabaseBrowserClient();
      // Construimos el redirectTo en el origen actual para que la cookie quede
      // en este subdominio. Supabase devuelve a /auth/callback con el code.
      const origin = window.location.origin;
      const callback = `${origin}/api/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callback }
      });
      if (error) {
        setErr(error.message);
        setLoading(false);
      }
      // Si todo OK, Supabase navega solo al popup de Google → no llega acá.
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al conectar con Google');
      setLoading(false);
    }
  }

  const baseCls = isLight
    ? 'w-full flex items-center justify-center gap-2.5 rounded-md border border-black/15 bg-white text-black py-2.5 font-medium hover:bg-black/[0.03] transition disabled:opacity-50'
    : 'w-full flex items-center justify-center gap-2.5 rounded-md border border-white/15 bg-white/[0.03] text-white py-2.5 font-medium hover:bg-white/10 transition disabled:opacity-50';

  return (
    <div className="space-y-2">
      <button type="button" onClick={handleClick} disabled={loading} className={baseCls}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        {loading ? 'Conectando…' : label}
      </button>
      {err && (
        <p className={`text-xs px-1 ${isLight ? 'text-rose-700' : 'text-rose-300'}`}>
          {err.toLowerCase().includes('provider is not enabled')
            ? 'Google auth no está configurado todavía. Pediselo al admin de Curplat.'
            : err}
        </p>
      )}
    </div>
  );
}
