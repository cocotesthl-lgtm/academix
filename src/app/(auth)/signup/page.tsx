import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";

export const dynamic = "force-dynamic";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">Curplat</Link>
          <h1 className="mt-6 text-3xl font-bold">Crear mi academia</h1>
          <p className="mt-2 text-white/60">
            Sin tarjeta. Sin mensualidades. Empezás a vender hoy.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}
