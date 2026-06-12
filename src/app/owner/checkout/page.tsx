import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutConfig } from "@/lib/checkout/types";
import {
  setTenantBaseFieldAction,
  addTenantExtraFieldAction,
  updateTenantExtraFieldAction,
  deleteTenantExtraFieldAction,
  moveTenantExtraFieldAction
} from "@/lib/checkout/actions";
import { CheckoutFieldsEditor } from "@/components/owner/checkout/CheckoutFieldsEditor";
import { PageHeader } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

export default async function CheckoutDefaultPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let storedCfg: unknown = null;
  let migrationMissing = false;
  try {
    const { data, error } = await svc
      .from('tenants').select('checkout_config').eq('id', tenant.id).single();
    if (error) migrationMissing = true;
    else storedCfg = (data as { checkout_config: unknown })?.checkout_config;
  } catch {
    migrationMissing = true;
  }
  const cfg = mergeCheckoutConfig(storedCfg);

  if (migrationMissing) {
    return (
      <div className="max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-amber-200">
          <p className="font-semibold mb-2">⚠️ Migración pendiente</p>
          <p className="text-sm">
            Falta correr la migración 0011_checkout_custom.sql en Supabase.
            Pegá <code className="bg-black/30 px-1 rounded">src/db/migrations/RUN_THIS_NOW.sql</code> en
            el SQL Editor de tu proyecto Supabase y dale RUN. Después recargá esta página.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Checkout"
        description="Qué datos pedís al comprador antes del pago. Aplica a todos los cursos por default — cada curso puede sobreescribir."
      />

      <CheckoutFieldsEditor
        config={cfg}
        actions={{
          setBaseField: setTenantBaseFieldAction,
          addExtra:     addTenantExtraFieldAction,
          updateExtra:  updateTenantExtraFieldAction,
          deleteExtra:  deleteTenantExtraFieldAction,
          moveExtra:    moveTenantExtraFieldAction
        }}
      />
    </div>
  );
}
