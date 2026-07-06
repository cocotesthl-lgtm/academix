import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const isAffiliate = !!next && next.startsWith('/affiliate');

  return (
    <main data-ui-theme="dark" className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">OfferNow</Link>
          {isAffiliate ? (
            <>
              <div className="text-4xl mt-6 mb-2">💼</div>
              <h1 className="text-3xl font-bold">Ingresá a tu cuenta</h1>
              <p className="mt-2 text-white/60 text-sm">
                Para acceder a tu panel de afiliado.
              </p>
            </>
          ) : (
            <h1 className="mt-6 text-3xl font-bold">Iniciar sesión</h1>
          )}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <Suspense fallback={<div className="text-white/40 text-sm">Cargando…</div>}>
            <LoginForm />
          </Suspense>
        </div>

        {/* CTA afiliados — sólo cuando NO venís ya del flow de afiliado */}
        {!isAffiliate && (
          <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5 text-center">
            <div className="text-2xl mb-1">💼</div>
            <h2 className="font-bold">¿Querés promocionar publicaciones y ganar comisión?</h2>
            <p className="text-sm text-white/65 mt-1 leading-snug">
              Registrate como afiliado de OfferNow. Una cuenta para promocionar
              publicaciones de todos los sitios.
            </p>
            <Link
              href="/affiliate"
              className="inline-block mt-3 rounded-md bg-orange-500 text-white px-5 py-2 text-sm font-semibold hover:bg-orange-400"
            >
              Quiero ser afiliado →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
