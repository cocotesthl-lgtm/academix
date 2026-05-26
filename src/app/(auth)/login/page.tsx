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
      </div>
    </main>
  );
}
