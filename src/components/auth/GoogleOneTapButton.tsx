'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';

/**
 * Botón "Continuar con Google" que abre un POPUP dentro del sitio
 * (Google Identity Services) en vez de redirigir a accounts.google.com.
 *
 * Requiere env NEXT_PUBLIC_GOOGLE_CLIENT_ID (el mismo Web Client ID
 * que ya está configurado en Google Cloud + Supabase Auth Provider).
 *
 * Si el env no está seteado, el componente no renderea nada y el
 * padre debe caer al GoogleAuthButton clásico (redirect flow) como
 * fallback.
 *
 * Docs:
 *   https://developers.google.com/identity/gsi/web/guides/overview
 *   https://supabase.com/docs/guides/auth/social-login/auth-google#google-pre-built
 */
export function GoogleOneTapButton({
  theme = 'dark',
  next
}: {
  theme?: 'dark' | 'light';
  next?: string;
}) {
  const router = useRouter();
  const btnRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId) return;
    if (typeof window === 'undefined') return;

    // Ya cargado desde otra instancia?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.google?.accounts?.id) {
      init();
      return;
    }
    // Cargar el script una vez
    const existing = document.querySelector<HTMLScriptElement>('script[data-gsi]');
    if (existing) {
      existing.addEventListener('load', init, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.setAttribute('data-gsi', 'true');
    s.onload = init;
    s.onerror = () => setError('No se pudo cargar Google. Probá el otro botón.');
    document.head.appendChild(s);
    // No lo removemos en cleanup: el script puede reutilizarse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function init() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.google?.accounts?.id || !btnRef.current) return;
    try {
      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true
      });
      w.google.accounts.id.renderButton(btnRef.current, {
        type: 'standard',
        theme: theme === 'light' ? 'outline' : 'filled_black',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: 360
      });
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inicializando Google');
    }
  }

  async function handleCredential(resp: { credential: string }) {
    if (!resp?.credential) {
      setError('Google no devolvió credenciales');
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: resp.credential
      });
      if (error) {
        setError(error.message);
        setProcessing(false);
        return;
      }
      // Redirigir a `next` o al post-auth default
      const dest = next ?? '/';
      if (dest.startsWith('http')) {
        window.location.href = dest;
      } else {
        router.push(dest);
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setProcessing(false);
    }
  }

  // Sin client_id no renderea nada — el padre cae al fallback
  if (!clientId) return null;

  return (
    <div className="w-full">
      <div className="flex justify-center">
        <div ref={btnRef} aria-busy={processing} />
      </div>
      {!ready && !error && (
        <div className={`h-11 rounded-md animate-pulse ${theme === 'light' ? 'bg-black/5' : 'bg-white/5'}`} />
      )}
      {processing && (
        <p className={`text-xs mt-2 text-center ${theme === 'light' ? 'text-black/60' : 'text-white/60'}`}>
          Iniciando sesión…
        </p>
      )}
      {error && (
        <p className="text-xs mt-2 text-center text-rose-400">{error}</p>
      )}
    </div>
  );
}
