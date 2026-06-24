import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { mergeCheckoutConfig, parseOption, type CheckoutField } from '@/lib/checkout/types';

export const dynamic = 'force-dynamic';

type Invoice = {
  id: string; concept: string; amount_cents: number; currency: string;
  due_at: string | null; status: string;
};

export default async function PagarInvoicePage({
  params
}: {
  params: Promise<{ tenantId: string; invoiceId: string }>;
}) {
  const { tenantId, invoiceId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/mi-cuenta/pagar/${invoiceId}`);

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRaw } = await (svc.from('customer_invoices') as any)
    .select('id, concept, amount_cents, currency, due_at, status')
    .eq('id', invoiceId).eq('tenant_id', tenantId).eq('user_id', user.id).maybeSingle();
  const invoice = invRaw as Invoice | null;
  if (!invoice) notFound();
  if (invoice.status !== 'pending') redirect('/mi-cuenta?invoice=already');

  // Form custom del tenant (mismo checkout_config que usa para vender productos)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tRow } = await (svc.from('tenants') as any)
    .select('checkout_config').eq('id', tenantId).maybeSingle();
  const cfg = mergeCheckoutConfig(tRow?.checkout_config);

  return (
    <article className="max-w-xl mx-auto px-6 py-10 space-y-6">
      <div>
        <Link href="/mi-cuenta" className="text-xs text-black/55 hover:text-black">← Mi cuenta</Link>
        <h1 className="text-2xl font-bold mt-1">Pagar factura</h1>
      </div>

      <div className="rounded-2xl border border-black/10 p-5 bg-white">
        <div className="text-xs text-black/55 uppercase tracking-wide">Detalle</div>
        <div className="text-lg font-semibold mt-1">{invoice.concept}</div>
        {invoice.due_at && <div className="text-xs text-black/55 mt-1">Vence: {invoice.due_at}</div>}
        <div className="mt-3 pt-3 border-t border-black/5">
          <div className="text-xs text-black/55 uppercase tracking-wide">Total a pagar</div>
          <div className="text-3xl font-bold font-mono mt-1">
            {invoice.currency} {(invoice.amount_cents / 100).toLocaleString('es-AR')}
          </div>
        </div>
      </div>

      <form action={`/api/invoices/${invoice.id}/checkout`} method="post" className="rounded-2xl border border-black/10 p-5 bg-white space-y-3">
        <h2 className="text-sm font-semibold">Tus datos</h2>

        {/* Campos base — siempre se piden los habilitados en el checkout_config */}
        {cfg.base_fields.name.enabled && (
          <label className="block">
            <span className="text-xs text-black/55">Nombre y apellido{cfg.base_fields.name.required && <span className="text-red-500"> *</span>}</span>
            <input name="buyer_name" required={cfg.base_fields.name.required} maxLength={120}
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
        )}
        {cfg.base_fields.dni.enabled && (
          <label className="block">
            <span className="text-xs text-black/55">DNI{cfg.base_fields.dni.required && <span className="text-red-500"> *</span>}</span>
            <input name="buyer_dni" required={cfg.base_fields.dni.required} maxLength={30}
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
        )}
        {cfg.base_fields.phone.enabled && (
          <label className="block">
            <span className="text-xs text-black/55">Celular{cfg.base_fields.phone.required && <span className="text-red-500"> *</span>}</span>
            <input name="buyer_phone" required={cfg.base_fields.phone.required} maxLength={30}
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
        )}
        {cfg.base_fields.location.enabled && (
          <label className="block">
            <span className="text-xs text-black/55">Ubicación{cfg.base_fields.location.required && <span className="text-red-500"> *</span>}</span>
            <input name="buyer_location" required={cfg.base_fields.location.required} maxLength={200}
              className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
          </label>
        )}
        <label className="block">
          <span className="text-xs text-black/55">Email <span className="text-red-500">*</span></span>
          <input name="buyer_email" type="email" required defaultValue={user.email ?? ''} maxLength={200}
            className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
        </label>

        {/* Extras custom (los del owner) */}
        {cfg.extra_fields.map((f) => (
          <ServerExtraInput key={f.id} field={f} />
        ))}

        <button type="submit"
          className="w-full rounded-md py-3 font-semibold text-white mt-2"
          style={{ background: primary }}>
          💳 Pagar {invoice.currency} {(invoice.amount_cents / 100).toLocaleString('es-AR')} con MercadoPago
        </button>
        <p className="text-[10px] text-black/45 text-center">
          Vas a ser redirigido a MercadoPago para completar el pago. La factura se marca pagada automáticamente al confirmar.
        </p>
      </form>
    </article>
  );
}

/** Render server-side de cada extra field del checkout_config del tenant. */
function ServerExtraInput({ field }: { field: CheckoutField }) {
  const name = `extra_${field.key}`;
  const req = field.required;
  const star = req && <span className="text-red-500"> *</span>;

  if (field.type === 'heading') {
    return (
      <div className="pt-2 pb-1 border-t border-black/10 first:border-t-0 first:pt-0">
        <div className="text-sm font-bold text-black">{field.label}</div>
        {field.helper && <p className="text-xs text-black/55 mt-0.5">{field.helper}</p>}
      </div>
    );
  }
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-start gap-2 rounded-md border border-black/15 p-3 text-sm cursor-pointer">
        <input name={name} type="checkbox" value="on" required={req} defaultChecked={field.default_checked ?? false}
          className="mt-0.5 w-4 h-4 accent-black" />
        <span className="flex-1">{field.label}{star}
          {(field.price_delta_cents ?? 0) !== 0 && (
            <span className={`ml-2 text-xs font-bold ${(field.price_delta_cents ?? 0) > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {(field.price_delta_cents ?? 0) > 0 ? '+' : ''}${((field.price_delta_cents ?? 0) / 100).toLocaleString('es-AR')}
            </span>
          )}
        </span>
      </label>
    );
  }
  if (field.type === 'textarea') {
    return (
      <label className="block">
        <span className="text-xs text-black/55">{field.label}{star}</span>
        <textarea name={name} required={req} rows={3} placeholder={field.placeholder} maxLength={1000}
          className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
      </label>
    );
  }
  if (field.type === 'select') {
    return (
      <label className="block">
        <span className="text-xs text-black/55">{field.label}{star}</span>
        <select name={name} required={req}
          className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm">
          <option value="">{field.placeholder ?? 'Elegí…'}</option>
          {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </label>
    );
  }
  if (field.type === 'radio') {
    return (
      <div>
        <div className="text-sm font-semibold mb-2">{field.label}{star}</div>
        <div className="space-y-1.5">
          {(field.options ?? []).map((o) => {
            const parsed = parseOption(o);
            return (
              <label key={o} className="flex items-center gap-2 rounded-md border-2 border-black/15 px-3 py-2 text-sm cursor-pointer hover:border-black/40">
                <input name={name} type="radio" value={o} required={req} className="w-4 h-4 accent-black" />
                <span className="flex-1">{parsed.label}</span>
                {parsed.deltaCents !== 0 && (
                  <span className={`text-xs font-bold ${parsed.deltaCents > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {parsed.deltaCents > 0 ? '+' : ''}${(parsed.deltaCents / 100).toLocaleString('es-AR')}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
  // text / email / tel / date / time / number
  const htmlType =
    field.type === 'number' ? 'number'
    : field.type === 'date' ? 'date'
    : field.type === 'time' ? 'time'
    : field.type === 'email' ? 'email'
    : field.type === 'tel' ? 'tel'
    : 'text';
  return (
    <label className="block">
      <span className="text-xs text-black/55">{field.label}{star}</span>
      <input name={name} type={htmlType} required={req} placeholder={field.placeholder} maxLength={200}
        className="mt-1 w-full rounded border border-black/15 px-3 py-2 text-sm" />
    </label>
  );
}
