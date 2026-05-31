import { Suspense } from "react";
import { getTenantById } from "@/lib/tenant/resolve";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

/**
 * Login del storefront del owner. Cuando alumno paga como invitado en
 * MercadoPago y vuelve a /learn sin estar logueado, lo redirigimos acá.
 * A diferencia del login global de Curplat, este:
 * - Usa el nombre + colores del owner (vía storefront layout)
 * - No muestra "Crear academia" — esto es la academia ya
 * - El CTA secundario es "Olvidaste tu contraseña" (TODO post-MVP)
 */
export default async function StorefrontLoginPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  return (
    <main className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Acceder a tu cuenta</h1>
          <p className="text-sm text-black/60 mt-2">
            Iniciá sesión con el email y contraseña que usaste al comprar el curso.
          </p>
        </div>
        <div
          className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
          style={{ ['--brand-primary' as string]: primary }}
        >
          <Suspense fallback={<div className="text-black/40 text-sm">Cargando…</div>}>
            <LoginForm theme="light" hideCreateAccount primaryColor={primary} />
          </Suspense>
        </div>
        <p className="text-center text-xs text-black/50">
          ¿Compraste un curso? Usá el mismo email y contraseña que pusiste en el checkout.
        </p>
      </div>
    </main>
  );
}
