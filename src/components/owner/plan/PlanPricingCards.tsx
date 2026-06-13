'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  annualSavingsPct, annualMonthlyEquivalent,
  type Plan, type BillingPeriod
} from '@/lib/plans/types';
import { setTenantPlanAction } from '@/lib/plans/actions';
import { showToast } from '@/components/owner/ToastBus';

/**
 * Pricing cards style SaaS: 3 tarjetas + toggle anual/mensual arriba.
 *
 * - Default: anual (precio mostrado = total año + sub: "equivalente $X/mes")
 * - Click "Mensual": muestra precio mensual + sub: "facturado mes a mes"
 * - Anual siempre con badge de ahorro % (calculado del precio actual)
 * - Plan con is_featured tiene borde + glow distinto
 * - Plan actual del owner está marcado como "Tu plan actual"
 *
 * Acepta promo code en input chico abajo — calcula descuento client-side
 * para preview (la validación real va en el servidor).
 */

export function PlanPricingCards({
  plans, currentPlanId, currentPeriod, currentStatus, defaultPeriod
}: {
  plans: Plan[];
  currentPlanId: string | null;
  currentPeriod: BillingPeriod;
  currentStatus: string;
  defaultPeriod: BillingPeriod;
}) {
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);
  const [promoCode, setPromoCode] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();

  function format(cents: number, currency: string) {
    return `${currency} ${(cents / 100).toLocaleString('es-AR')}`;
  }

  function selectPlan(planId: string) {
    start(async () => {
      const fd = new FormData();
      fd.append('plan_id', planId);
      fd.append('billing_period', period);
      await setTenantPlanAction(fd);
      showToast('Plan actualizado — quedaste en trial', 'success');
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Toggle período */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-full border border-white/15 bg-white/[0.03] p-1">
          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition ${
              period === 'monthly' ? 'bg-white text-black' : 'text-white/65 hover:text-white'
            }`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setPeriod('annual')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition flex items-center gap-2 ${
              period === 'annual' ? 'bg-white text-black' : 'text-white/65 hover:text-white'
            }`}
          >
            Anual
            {plans.length > 0 && annualSavingsPct(plans[0]) > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                period === 'annual' ? 'bg-emerald-500 text-white' : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                -{annualSavingsPct(plans[0])}%
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className={`grid gap-4 ${plans.length === 1 ? 'sm:grid-cols-1 max-w-md mx-auto' : plans.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        {plans.map((plan) => {
          const isCurrent = currentPlanId === plan.id;
          const isFeatured = plan.is_featured;
          const priceDisplay = period === 'annual' ? annualMonthlyEquivalent(plan) : plan.price_cents_monthly;

          return (
            <div
              key={plan.id}
              className={`rounded-2xl border-2 p-6 flex flex-col relative ${
                isFeatured
                  ? 'border-fuchsia-500 bg-gradient-to-b from-fuchsia-500/10 to-transparent'
                  : 'border-white/15 bg-white/[0.02]'
              }`}
            >
              {isFeatured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-fuchsia-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full px-3 py-1">
                  ★ Más elegido
                </div>
              )}

              <div className="mb-5">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                {plan.tagline && <p className="text-sm text-white/65 mt-1">{plan.tagline}</p>}
              </div>

              <div className="mb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold tabular-nums">
                    {format(priceDisplay, plan.currency)}
                  </span>
                  <span className="text-sm text-white/55">/mes</span>
                </div>
                {period === 'annual' ? (
                  <p className="text-xs text-emerald-300 mt-1">
                    Facturado {format(plan.price_cents_annual, plan.currency)} por año
                  </p>
                ) : (
                  <p className="text-xs text-white/45 mt-1">
                    Facturado mes a mes
                  </p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 text-sm flex-1">
                <FeatureRow check>
                  {plan.features.domains_max > 0
                    ? `${plan.features.domains_max} dominio${plan.features.domains_max > 1 ? 's' : ''} propio${plan.features.domains_max > 1 ? 's' : ''}`
                    : 'Subdominio gratuito'}
                </FeatureRow>
                <FeatureRow check>
                  {plan.features.email_marketing_monthly > 0
                    ? `${plan.features.email_marketing_monthly.toLocaleString('es-AR')} emails marketing/mes`
                    : 'Sin email marketing'}
                </FeatureRow>
                <FeatureRow check>
                  {plan.features.storage_gb} GB de storage
                </FeatureRow>
                {plan.features.uploads_enabled && (
                  <FeatureRow check>Subir imágenes y videos</FeatureRow>
                )}
                {plan.features.featured_listings > 0 && (
                  <FeatureRow check>
                    {plan.features.featured_listings >= 999
                      ? 'Cursos destacados ilimitados'
                      : `${plan.features.featured_listings} curso${plan.features.featured_listings > 1 ? 's' : ''} destacado${plan.features.featured_listings > 1 ? 's' : ''}`}
                  </FeatureRow>
                )}
                <FeatureRow check>
                  Soporte {plan.features.support_priority ? 'prioritario' : 'estándar'} ({plan.features.support_sla_hours}h)
                </FeatureRow>
                {plan.features.extras.map((extra, i) => (
                  <FeatureRow key={i} check>{extra}</FeatureRow>
                ))}
              </ul>

              {/* CTA */}
              {isCurrent ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-center py-2.5 text-sm font-semibold">
                  ✓ Plan actual {currentStatus === 'trial' ? '(trial)' : ''}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => selectPlan(plan.id)}
                  disabled={pending}
                  className={`w-full rounded-md py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                    isFeatured
                      ? 'bg-fuchsia-500 text-white hover:bg-fuchsia-400'
                      : 'bg-white text-black hover:bg-white/90'
                  }`}
                >
                  {pending ? 'Guardando…' : currentPlanId ? 'Cambiar a este' : 'Activar trial 7 días'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Promo code */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 max-w-md mx-auto">
        <div className="text-xs uppercase tracking-wider text-white/55 mb-2 text-center">
          ¿Tenés un código promocional?
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
            placeholder="Pegá tu código"
            className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm font-mono uppercase"
            maxLength={20}
          />
          <button
            type="button"
            disabled={!promoCode.trim()}
            onClick={() => showToast('Códigos promo se aplican en checkout (próximamente)', 'info')}
            className="rounded bg-white/10 hover:bg-white/15 px-4 py-2 text-sm font-medium disabled:opacity-30"
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ check, children }: { check?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className={`shrink-0 mt-0.5 ${check ? 'text-emerald-400' : 'text-white/30'}`}>
        {check ? '✓' : '○'}
      </span>
      <span className="text-white/80">{children}</span>
    </li>
  );
}
