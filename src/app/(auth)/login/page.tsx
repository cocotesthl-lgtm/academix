import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">Curplat</Link>
          <h1 className="mt-6 text-3xl font-bold">Iniciar sesión</h1>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <Suspense fallback={<div className="text-white/40 text-sm">Cargando…</div>}>
            <LoginForm />
          </Suspense>
        </div>

        {/* CTA afiliados — los lleva al registro de afiliado en marketplace */}
        <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-5 text-center">
          <div className="text-2xl mb-1">💼</div>
          <h2 className="font-bold">¿Querés promocionar cursos y ganar comisión?</h2>
          <p className="text-sm text-white/65 mt-1 leading-snug">
            Registrate como afiliado de Curplat. Una cuenta para promocionar
            cursos de todas las academias.
          </p>
          <Link
            href="/affiliate"
            className="inline-block mt-3 rounded-md bg-fuchsia-500 text-white px-5 py-2 text-sm font-semibold hover:bg-fuchsia-400"
          >
            Quiero ser afiliado →
          </Link>
        </div>
      </div>
    </main>
  );
}
