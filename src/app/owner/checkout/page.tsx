import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { mergeCheckoutConfig } from "@/lib/checkout/types";
import {
  setTenantBaseFieldAction,
  addTenantExtraFieldAction,
  updateTenantExtraFieldAction,
  deleteTenantExtraFieldAction,
  moveTenantExtraFieldAction,
  setCartEnabledAction,
  setCartUiAction,
  applyTenantCheckoutPresetAction,
  setCheckoutDesignColorAction,
  setCheckoutDesignCardStyleAction,
  resetCheckoutDesignAction
} from "@/lib/checkout/actions";
import { CHECKOUT_PRESETS } from "@/lib/checkout/presets";
import { CheckoutFieldsEditor } from "@/components/owner/checkout/CheckoutFieldsEditor";
import { PageHeader } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

export default async function CheckoutDefaultPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  let storedCfg: unknown = null;
  let migrationMissing = false;
  let cartEnabled = false;
  let cartPosition: 'header' | 'floating' | 'both' = 'header';
  let cartDisplay: 'dropdown' | 'page' = 'dropdown';
  try {
    const { data, error } = await svc
      .from('tenants').select('checkout_config, cart_enabled, cart_position, cart_display').eq('id', tenant.id).single();
    if (error) migrationMissing = true;
    else {
      const row = data as {
        checkout_config: unknown;
        cart_enabled?: boolean;
        cart_position?: string;
        cart_display?: string;
      };
      storedCfg = row.checkout_config;
      cartEnabled = row.cart_enabled ?? false;
      if (row.cart_position === 'floating' || row.cart_position === 'both') cartPosition = row.cart_position;
      if (row.cart_display === 'page') cartDisplay = 'page';
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
        description="Qué datos pedís al comprador antes del pago. Aplica a todas las publicaciones por default — cada publicación puede sobreescribir."
      />

      {/* Modo carrito toggle */}
      <div className="rounded-xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🛒 Modo carrito
              {cartEnabled && <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">ACTIVO</span>}
            </h2>
            <p className="text-sm text-white/65 mt-1">
              Cuando está activo: aparece un carrito flotante 🛒 en tu sitio público.
              Los visitantes pueden agregar varias publicaciones / packs / tickets y pagar todo junto en un solo checkout.
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

        {/* Configuración UI del carrito (sólo cuando está activo) */}
        {cartEnabled && (
          <form action={setCartUiAction} className="mt-5 pt-5 border-t border-white/10 grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-2">
                Posición del botón
              </label>
              <select name="cart_position" defaultValue={cartPosition}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="header" className="bg-[#0a0a0a]">En el header (al lado del avatar)</option>
                <option value="floating" className="bg-[#0a0a0a]">Flotante (abajo a la derecha)</option>
                <option value="both" className="bg-[#0a0a0a]">Ambos (header + flotante)</option>
              </select>
              <p className="text-[11px] text-white/45 mt-1">Header = sobrio. Flotante = más visible.</p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-white/55 font-semibold mb-2">
                Modo del carrito
              </label>
              <select name="cart_display" defaultValue={cartDisplay}
                className="w-full rounded bg-white/5 border border-white/15 px-3 py-2 text-sm">
                <option value="dropdown" className="bg-[#0a0a0a]">Ventana flotante (dropdown rápido)</option>
                <option value="page" className="bg-[#0a0a0a]">Página dedicada (estilo MercadoLibre)</option>
              </select>
              <p className="text-[11px] text-white/45 mt-1">Dropdown = fluido. Página = más espacio.</p>
            </div>
            <div className="sm:col-span-2">
              <button type="submit"
                className="rounded bg-white text-black text-sm font-semibold px-4 py-2 hover:bg-white/90">
                Guardar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ───── Presets de checkout: 1-click setups ───── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-3">
          <h2 className="text-lg font-semibold">⚡ Presets de campos</h2>
          <p className="text-sm text-white/55 mt-1">
            Elegí uno y configuramos los campos típicos para vos. Después podés ajustar abajo si querés.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {CHECKOUT_PRESETS.map((p) => (
            <form key={p.id} action={applyTenantCheckoutPresetAction}>
              <input type="hidden" name="preset" value={p.id} />
              <button type="submit"
                className="w-full text-left rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/25 p-3 transition">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-lg leading-none">{p.emoji}</span>
                  <span>{p.label}</span>
                </div>
                <p className="text-[11px] text-white/55 mt-1.5 leading-snug">{p.description}</p>
              </button>
            </form>
          ))}
        </div>
        <p className="text-[10px] text-white/35 mt-3">
          ⚠️ Al aplicar un preset, sobreescribís la configuración actual de campos (los campos extra personalizados se pierden).
        </p>
      </div>

      {/* ───── Diseño visual del checkout (colores + tarjetas) ───── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">🎨 Diseño del checkout</h2>
          <p className="text-sm text-white/55 mt-1">
            Por default toma el color principal del tenant. Podés overridear
            desde acá el CTA "Pagar", el color de acento (radios seleccionados)
            y el estilo de tarjetas.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">
              Color del botón "Pagar"
            </label>
            <form action={setCheckoutDesignColorAction} className="flex items-center gap-2">
              <input type="hidden" name="which" value="cta_color" />
              <input type="color" name="value"
                defaultValue={cfg.design?.cta_color ?? '#111827'}
                className="w-14 h-11 rounded-md bg-transparent border border-white/15 cursor-pointer" />
              <button type="submit"
                className="text-xs px-3 py-2 rounded bg-white text-black font-semibold hover:bg-white/90">
                Aplicar
              </button>
              {cfg.design?.cta_color && (
                <span className="text-[10px] text-white/40 ml-2">
                  Override: <code className="font-mono">{cfg.design.cta_color}</code>
                </span>
              )}
            </form>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">
              Color de acento (radios seleccionados)
            </label>
            <form action={setCheckoutDesignColorAction} className="flex items-center gap-2">
              <input type="hidden" name="which" value="accent_color" />
              <input type="color" name="value"
                defaultValue={cfg.design?.accent_color ?? cfg.design?.cta_color ?? '#111827'}
                className="w-14 h-11 rounded-md bg-transparent border border-white/15 cursor-pointer" />
              <button type="submit"
                className="text-xs px-3 py-2 rounded bg-white text-black font-semibold hover:bg-white/90">
                Aplicar
              </button>
              {cfg.design?.accent_color && (
                <span className="text-[10px] text-white/40 ml-2">
                  Override: <code className="font-mono">{cfg.design.accent_color}</code>
                </span>
              )}
            </form>
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">
            Estilo de tarjetas
          </label>
          <div className="flex gap-2 flex-wrap">
            {(['rounded', 'square'] as const).map((s) => {
              const active = (cfg.design?.card_style ?? 'rounded') === s;
              return (
                <form key={s} action={setCheckoutDesignCardStyleAction}>
                  <input type="hidden" name="style" value={s} />
                  <button type="submit"
                    className={`text-xs px-3 py-1.5 rounded border transition ${
                      active
                        ? 'bg-white text-black border-white font-semibold'
                        : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/10'
                    }`}>
                    {s === 'rounded' ? '🔵 Redondeadas (default)' : '⬜ Cuadradas (minimal)'}
                  </button>
                </form>
              );
            })}
          </div>
        </div>

        <form action={resetCheckoutDesignAction} className="mt-4">
          <button type="submit"
            className="text-[11px] text-white/40 hover:text-white underline underline-offset-2">
            Volver a defaults (usar color del tenant)
          </button>
        </form>
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
