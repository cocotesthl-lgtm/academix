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
  next,
  showButton = true
}: {
  theme?: 'dark' | 'light';
  next?: string;
  /** false = solo dispara el One Tap widget flotante, sin botón visible. */
  showButton?: boolean;
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

    // Guard: evitar re-inicializar GIS si ya lo hicimos en esta sesión.
    // Sin esto, StrictMode / re-mounts causan
    // "initialize() called multiple times" warnings.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (w.__gsiInitialized) {
      // Ya inicializado; si el botón está montado, renderizarlo con la
      // config actual pero sin re-inicializar el prompt.
      if (showButton && btnRef.current && w.google?.accounts?.id) {
        try {
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
        } catch { /* ignore */ }
      }
      return;
    }

    // Ya cargado desde otra instancia?
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
    if (!w.google?.accounts?.id) return;
    // Cuando showButton=true necesitamos el ref para renderButton; cuando
    // false solo disparamos el prompt (no hace falta el ref).
    if (showButton && !btnRef.current) return;
    try {
      w.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredential,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
        // FedCM requerido por Chrome ≥ 128 para que el One Tap se muestre.
        use_fedcm_for_prompt: true
      });
      if (showButton && btnRef.current) {
        w.google.accounts.id.renderButton(btnRef.current, {
          type: 'standard',
          theme: theme === 'light' ? 'outline' : 'filled_black',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 360
        });
      }
      // One Tap: dispara el widget flotante en la esquina superior derecha
      // con la lista de cuentas de Google del user. Sin clicks — aparece
      // solo. Si el user tiene sesión de Google en el browser y no está
      // ya logueado en el sitio, ve el prompt.
      w.google.accounts.id.prompt();
      w.__gsiInitialized = true; // Guard para próximos mounts
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

  // Modo solo-prompt: no renderea nada visible, solo dispara el widget
  // flotante de One Tap desde el useEffect. Sí muestra el error si algo
  // falla, chiquito abajo a la derecha.
  if (!showButton) {
    return error
      ? <div className="fixed bottom-4 right-4 z-40 text-xs text-rose-400 bg-black/70 rounded px-2 py-1">{error}</div>
      : null;
  }

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
