import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // ¿Viene desde el flow de afiliado? (CTA en /login, /buscar o /affiliate)
  const isAffiliate = !!next && next.startsWith('/affiliate');

  return (
    <main data-ui-theme="dark" className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">Curplat</Link>
          {isAffiliate ? (
            <>
              <div className="text-4xl mt-6 mb-2">💼</div>
              <h1 className="text-3xl font-bold">Crear cuenta de afiliado</h1>
              <p className="mt-2 text-white/60">
                Promocioná cursos de cualquier academia y ganá comisión.
                Gratis. Sin tarjeta.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-6 text-3xl font-bold">Crear mi academia</h1>
              <p className="mt-2 text-white/60">
                Sin tarjeta. Sin mensualidades. Empezás a vender hoy.
              </p>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <Suspense fallback={<div className="text-white/40 text-sm">Cargando…</div>}>
            <SignupForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
