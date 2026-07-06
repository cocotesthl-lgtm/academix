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
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </Link>
          {isAffiliate ? (
            <>
              <div className="text-4xl mt-6 mb-2">💼</div>
              <h1 className="text-3xl font-bold">Crear cuenta de afiliado</h1>
              <p className="mt-2 text-neutral-600">
                Promocioná publicaciones de cualquier sitio y ganá comisión.
                Gratis. Sin tarjeta.
              </p>
            </>
          ) : (
            <>
              <div className="text-4xl mt-6 mb-2">🏫</div>
              <h1 className="text-3xl font-bold">Crear mi sitio</h1>
              <p className="mt-2 text-neutral-600">
                Sin tarjeta. Sin mensualidades. Empezás a vender hoy.
              </p>
            </>
          )}
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<div className="text-neutral-400 text-sm">Cargando…</div>}>
            <SignupForm />
          </Suspense>
        </div>
        <p className="text-center text-xs text-neutral-500">
          <Link href="/signup" className="hover:text-neutral-900 underline-offset-2 hover:underline">
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
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </Link>
          <h1 className="mt-6 text-3xl md:text-4xl font-bold">¿Qué tipo de cuenta querés crear?</h1>
          <p className="mt-3 text-neutral-600">
            Elegí el rol con el que vas a empezar. Después podés sumar otros si querés (no es excluyente).
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Propietario */}
          <Link
            href="/signup?type=owner"
            className="rounded-2xl border border-neutral-200 bg-white p-6 hover:border-neutral-900 hover:shadow-md transition group"
          >
            <div className="text-4xl mb-3">🏫</div>
            <h2 className="text-lg font-bold mb-1">Propietario</h2>
            <p className="text-sm text-neutral-600 leading-snug">
              Quiero crear <strong>mi propio sitio</strong>: subir mis publicaciones, vender con
              mi marca, cobrar a MercadoPago, gestionar clientes.
            </p>
            <ul className="text-xs text-neutral-500 mt-3 space-y-1">
              <li>✓ Subdominio propio (sitio.bzseguridad.store)</li>
              <li>✓ Branding 100% configurable</li>
              <li>✓ Cobrás directo a tu MercadoPago</li>
              <li>✓ Sumás afiliados e instructores que vendan por vos</li>
            </ul>
            <div className="mt-4 text-orange-500 text-sm font-semibold opacity-0 group-hover:opacity-100 transition">
              Empezar →
            </div>
          </Link>

          {/* Afiliado */}
          <Link
            href="/signup?next=/affiliate"
            className="rounded-2xl border border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-6 hover:border-orange-500 hover:shadow-md transition group"
          >
            <div className="text-4xl mb-3">💼</div>
            <h2 className="text-lg font-bold mb-1">Afiliado</h2>
            <p className="text-sm text-neutral-600 leading-snug">
              Quiero <strong>revender publicaciones</strong> de sitios existentes, conseguir
              trabajo como <strong>instructor</strong> y/o ayudar como <strong>administrador</strong>
              en sitios de OfferNow.
            </p>
            <ul className="text-xs text-neutral-500 mt-3 space-y-1">
              <li>✓ 1 cuenta para todos los sitios</li>
              <li>✓ Link único por publicación · ganás comisión por venta</li>
              <li>✓ Los owners pueden ascenderte a instructor</li>
              <li>✓ Panel global con stats cross-sitio</li>
            </ul>
            <div className="mt-4 text-orange-600 text-sm font-semibold opacity-0 group-hover:opacity-100 transition">
              Empezar →
            </div>
          </Link>
        </div>

        <p className="text-center text-sm text-neutral-600">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-neutral-900 hover:underline font-medium">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
