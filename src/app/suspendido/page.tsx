import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getUserModerationStatus } from '@/lib/moderation/user-status';
import { SignoutButton } from '@/components/auth/SignoutButton';

export const dynamic = 'force-dynamic';

/**
 * Página informativa para usuarios con status = 'suspended'.
 * - Guardas: sin sesión → /login. Status='active' → /. Sólo entra el que
 *   realmente está suspendido (o eventualmente under_review vía ?peek).
 * - No hay onboarding aquí — el user pierde acceso a paneles hasta que
 *   founder lo reactive.
 */
export default async function SuspendedPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const status = await getUserModerationStatus(user.id);
  const params = await searchParams;
  // Bajo revisión también puede mostrar esta página si viene explícito
  const underReview = params.reason === 'under_review' || status === 'under_review';
  if (status === 'active' && !underReview) redirect('/');

  const isSuspended = status === 'suspended';

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/[0.03] p-8 space-y-5 text-center">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
          isSuspended ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300'
        }`}>
          {isSuspended ? (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold">
            {isSuspended ? 'Tu cuenta está suspendida' : 'Tu cuenta está bajo revisión'}
          </h1>
          <p className="text-sm text-white/60 mt-2 leading-relaxed">
            {isSuspended ? (
              <>
                Nuestro equipo suspendió tu cuenta por posible violación de los términos de uso.
                No podés acceder al panel ni a tus sitios hasta que revisemos el caso.
              </>
            ) : (
              <>
                Estamos revisando tu cuenta. Podés seguir usando la plataforma con normalidad
                — te avisamos cuando terminemos.
              </>
            )}
          </p>
        </div>

        <div className="text-xs text-white/50 pt-2 space-y-1">
          <div>Cuenta: <span className="font-mono text-white/80">{user.email}</span></div>
          <div>
            Si creés que es un error, escribinos a{' '}
            <a href="mailto:soporte@bzseguridad.store" className="underline text-white/80 hover:text-white">
              soporte@bzseguridad.store
            </a>
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2 justify-center">
          {!isSuspended && (
            <Link href="/" className="rounded-md bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
              Continuar al inicio
            </Link>
          )}
          <SignoutButton
            redirectTo="/"
            className="rounded-md border border-white/20 text-white/80 hover:bg-white/[0.06] px-4 py-2 text-sm font-medium"
          />
        </div>
      </div>
    </main>
  );
}
