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

export const dynamic = "force-dynamic";

export default async function CheckoutDefaultPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from('tenants').select('checkout_config').eq('id', tenant.id)
    .single<{ checkout_config: unknown }>();
  const cfg = mergeCheckoutConfig(data?.checkout_config);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Checkout — campos default</h1>
        <p className="text-white/60 text-sm mt-1">
          Definí qué datos pedís a los compradores antes del pago.
          Estos se aplican a todos los cursos por default. Cada curso puede tener
          su propia config si lo necesita (desde la página del curso).
        </p>
      </div>

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
