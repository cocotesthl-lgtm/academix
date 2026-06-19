import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutConfig } from "@/lib/checkout/types";
import {
  setTenantBaseFieldAction,
  addTenantExtraFieldAction,
  updateTenantExtraFieldAction,
  deleteTenantExtraFieldAction,
  moveTenantExtraFieldAction,
  setCartEnabledAction
} from "@/lib/checkout/actions";
import { CheckoutFieldsEditor } from "@/components/owner/checkout/CheckoutFieldsEditor";
import { PageHeader } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

export default async function CheckoutDefaultPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let storedCfg: unknown = null;
  let migrationMissing = false;
  let cartEnabled = false;
  try {
    const { data, error } = await svc
      .from('tenants').select('checkout_config, cart_enabled').eq('id', tenant.id).single();
    if (error) migrationMissing = true;
    else {
      storedCfg = (data as { checkout_config: unknown; cart_enabled?: boolean })?.checkout_config;
      cartEnabled = (data as { cart_enabled?: boolean })?.cart_enabled ?? false;
    }
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

      {/* Modo carrito toggle */}
      <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🛒 Modo carrito
              {cartEnabled && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">ACTIVO</span>}
            </h2>
            <p className="text-sm text-white/65 mt-1">
              Cuando está activo: aparece un carrito flotante 🛒 en tu sitio público.
              Los visitantes pueden agregar varios cursos / packs / tickets y pagar todo junto en un solo checkout.
              Cuando está desactivado: cada producto se paga individualmente (default).
            </p>
          </div>
          <form action={setCartEnabledAction}>
            <input type="hidden" name="cart_enabled" value={cartEnabled ? 'false' : 'true'} />
            <button
              type="submit"
              className={`rounded-md px-5 py-2.5 text-sm font-semibold whitespace-nowrap transition ${
                cartEnabled
                  ? 'border border-rose-500/30 text-rose-300 hover:bg-rose-500/10'
                  : 'bg-white text-black hover:bg-white/90'
              }`}
            >
              {cartEnabled ? 'Desactivar carrito' : '🛒 Activar carrito'}
            </button>
          </form>
        </div>
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
