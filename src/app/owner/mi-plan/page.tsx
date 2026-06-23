import { requireOwner } from "@/lib/auth/guards";
import { getActivePlans, getTenantPlan } from "@/lib/plans/queries";
import { PlanPricingCards } from "@/components/owner/plan/PlanPricingCards";
import { PageHeader } from "@/components/owner/PageHeader";
import { EmptyState } from "@/components/owner/EmptyState";
import type { BillingPeriod } from "@/lib/plans/types";

export const dynamic = "force-dynamic";

/**
 * Página del owner para ver/cambiar su plan.
 * Por ahora el cambio activa trial — el cobro real (Fase 2) requiere
 * configurar MP de la plataforma + wirear suscripciones.
 */
export default async function MiPlanPage({
  searchParams
}: {
  searchParams: Promise<{ period?: BillingPeriod }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;

  const [plans, current] = await Promise.all([
    getActivePlans(),
    getTenantPlan(tenant.id)
  ]);

  // Default: anual (más conveniente para el owner + le da más margen al founder)
  const defaultPeriod: BillingPeriod = sp.period ?? current.billing_period ?? 'annual';

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        title="Mi plan"
        description="Elegí el plan que mejor se adapta a tu sitio. Podés cambiarlo cuando quieras."
      />

      {plans.length === 0 ? (
        <EmptyState
          icon="📦"
          title="Los planes aún no están configurados"
          description="El equipo de Curplat está terminando de armar los planes disponibles."
        />
      ) : (
        <PlanPricingCards
          plans={plans}
          currentPlanId={current.plan?.id ?? null}
          currentPeriod={current.billing_period}
          currentStatus={current.subscription_status}
          defaultPeriod={defaultPeriod}
        />
      )}

      {current.plan && current.subscription_status === 'trial' && current.trial_ends_at && (
        <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 text-sm">
          <strong className="text-fuchsia-200">🎁 Estás en período de prueba.</strong>
          <p className="text-white/75 mt-1">
            Tu trial termina el {new Date(current.trial_ends_at).toLocaleDateString('es-AR', {
              day: 'numeric', month: 'long', year: 'numeric'
            })}. Después tenés que confirmar tu suscripción para seguir usando el plan.
          </p>
        </div>
      )}
    </div>
  );
}
