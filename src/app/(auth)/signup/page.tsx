import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; type?: string }>;
}) {
  const { next, type } = await searchParams;
  const isAffiliate = !!next && next.startsWith('/affiliate');
  const isOwner = type === 'owner';

  // Sin params → mostrar CHOOSER para que el user elija qué tipo de cuenta.
  // El user después se ve dirigido a la versión correspondiente del form.
  if (!isAffiliate && !isOwner) {
    return <AccountChooser />;
  }

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
                Promocioná publicaciones de cualquier sitio y ganá comisión.
                Gratis. Sin tarjeta.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mt-6 mb-2">🏫</div>
              <h1 className="text-3xl font-bold">Crear mi sitio</h1>
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
        <p className="text-center text-xs text-white/40">
          <Link href="/signup" className="hover:text-white underline-offset-2 hover:underline">
            ← Cambiar tipo de cuenta
          </Link>
        </p>
      </div>
    </main>
  );
}

/* ─────────── Chooser: Propietario vs Afiliado ─────────── */

function AccountChooser() {
  return (
    <main data-ui-theme="dark" className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">Curplat</Link>
          <h1 className="mt-6 text-3xl md:text-4xl font-bold">¿Qué tipo de cuenta querés crear?</h1>
          <p className="mt-3 text-white/60">
            Elegí el rol con el que vas a empezar. Después podés sumar otros si querés (no es excluyente).
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Propietario */}
          <Link
            href="/signup?type=owner"
            className="rounded-2xl border border-white/15 bg-white/[0.02] p-6 hover:border-white/40 hover:bg-white/[0.05] transition group"
          >
            <div className="text-4xl mb-3">🏫</div>
            <h2 className="text-lg font-bold mb-1">Propietario</h2>
            <p className="text-sm text-white/65 leading-snug">
              Quiero crear <strong>mi propia sitio</strong>: subir mis publicaciones, vender con
              mi marca, cobrar a MercadoPago, gestionar alumnos.
            </p>
            <ul className="text-xs text-white/50 mt-3 space-y-1">
              <li>✓ Subdominio propio (sitio.curplat.com)</li>
              <li>✓ Branding 100% configurable</li>
              <li>✓ Cobrás directo a tu MercadoPago</li>
              <li>✓ Sumás afiliados e instructores que vendan por vos</li>
            </ul>
            <div className="mt-4 text-amber-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition">
              Empezar →
            </div>
          </Link>

          {/* Afiliado */}
          <Link
            href="/signup?next=/affiliate"
            className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-6 hover:border-orange-500/60 transition group"
          >
            <div className="text-4xl mb-3">💼</div>
            <h2 className="text-lg font-bold mb-1">Afiliado</h2>
            <p className="text-sm text-white/65 leading-snug">
              Quiero <strong>revender publicaciones</strong> de sitios existentes, conseguir
              trabajo como <strong>instructor</strong> y/o ayudar como <strong>administrador</strong>
              en sitios de Curplat.
            </p>
            <ul className="text-xs text-white/50 mt-3 space-y-1">
              <li>✓ 1 cuenta para todos los sitios</li>
              <li>✓ Link único por publicación · ganás comisión por venta</li>
              <li>✓ Los owners pueden ascenderte a instructor</li>
              <li>✓ Panel global con stats cross-sitio</li>
            </ul>
            <div className="mt-4 text-amber-400 text-sm font-semibold opacity-0 group-hover:opacity-100 transition">
              Empezar →
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-white/60">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-white hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
