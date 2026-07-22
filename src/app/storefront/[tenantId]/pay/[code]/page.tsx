import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';
import { trackPayLinkViewAction } from '@/lib/pay-links/actions';

export const dynamic = 'force-dynamic';

type LinkRow = {
  id: string;
  tenant_id: string;
  code: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  require_email: boolean;
  require_name: boolean;
  require_phone: boolean;
  require_dni: boolean;
  custom_note: string | null;
  affiliate_user_id: string | null;
  parent_link_id: string | null;
};

type Tenant = { id: string; name: string; slug: string; logo_url: string | null; primary_color: string | null };

/**
 * Página pública de un pay-link. Server-rendered — parsea el code, valida
 * estado (activo, no vencido, no agotado), muestra los campos requeridos
 * al buyer y postea a /api/pay-links/[code]/checkout que crea la preference
 * MP y redirige al init_point.
 */
export default async function PayLinkPublicPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string; code: string }>;
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { tenantId, code } = await params;
  const sp = await searchParams;
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: link } = await (svc.from('pay_links') as any)
    .select('id, tenant_id, code, title, description, cover_url, amount_cents, currency, status, max_uses, uses_count, expires_at, require_email, require_name, require_phone, require_dni, custom_note, affiliate_user_id, parent_link_id')
    .eq('code', code).eq('tenant_id', tenantId).maybeSingle();
  if (!link) notFound();
  const l = link as LinkRow;

  const { data: tenantData } = await svc
    .from('tenants').select('id, name, slug, logo_url, primary_color').eq('id', l.tenant_id)
    .maybeSingle<Tenant>();
  const tenant = tenantData;

  // Estado derivado
  const now = new Date();
  const isExpired = l.expires_at ? new Date(l.expires_at) < now : false;
  const isUsedUp = l.max_uses !== null && l.uses_count >= l.max_uses;
  const isActive = l.status === 'active' && !isExpired && !isUsedUp;

  // Fire-and-forget: contar la vista
  trackPayLinkViewAction(code).catch(() => {});

  // Si el link tiene affiliate_user_id (variante hija), setear cookie del
  // ref para que el checkout lo persista al pagar.
  const cookieStore = await cookies();
  if (l.affiliate_user_id) {
    cookieStore.set('paylink_aff', l.affiliate_user_id, {
      httpOnly: false, secure: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/'
    });
  }

  const primary = tenant?.primary_color || '#10b981';
  const paidOk = sp.status === 'success';
  const paidFail = sp.status === 'failure' || sp.status === 'rejected';
  const errorMsg = sp.error;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header con branding del tenant */}
        <div className="flex items-center gap-3 mb-6">
          {tenant?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logo_url} alt={tenant.name}
              className="w-10 h-10 rounded-lg object-cover" />
          )}
          <div>
            <div className="text-xs text-neutral-500">Pago a</div>
            <div className="font-semibold">{tenant?.name ?? 'Comercio'}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
          {l.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={l.cover_url} alt="" className="w-full aspect-video object-cover" />
          )}
          <div className="p-6 space-y-5">
            <div>
              <h1 className="text-xl font-bold">{l.title}</h1>
              {l.description && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2 whitespace-pre-line">{l.description}</p>
              )}
            </div>

            <div className="rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 py-3 flex items-baseline justify-between">
              <span className="text-xs text-neutral-500 uppercase tracking-wider">Total</span>
              <span className="text-2xl font-bold">
                {(l.amount_cents / 100).toLocaleString('es-AR')} <span className="text-sm font-normal text-neutral-500">{l.currency}</span>
              </span>
            </div>

            {l.custom_note && (
              <div className="text-[11px] text-neutral-500 border-l-2 border-neutral-300 dark:border-neutral-700 pl-2 py-0.5">
                {l.custom_note}
              </div>
            )}

            {paidOk && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                ✅ Pago confirmado. En instantes te llega el comprobante por email.
              </div>
            )}
            {paidFail && (
              <div className="rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-300 dark:border-rose-800 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                ❌ No se pudo procesar el pago. Volvé a intentar.
              </div>
            )}
            {errorMsg && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                ⚠️ {decodeURIComponent(errorMsg)}
              </div>
            )}

            {!isActive ? (
              <div className="rounded-lg bg-neutral-100 dark:bg-neutral-800 px-4 py-3 text-sm text-neutral-600 dark:text-neutral-400">
                {l.status === 'paused' && '⏸️ Este link está pausado por el vendedor.'}
                {isExpired && '⏰ Este link venció el ' + new Date(l.expires_at!).toLocaleDateString('es-AR') + '.'}
                {isUsedUp && '🎯 Este link llegó al cupo máximo.'}
                {l.status !== 'paused' && !isExpired && !isUsedUp && 'Este link no está disponible.'}
              </div>
            ) : (
              <form method="POST" action={`/api/pay-links/${l.code}/checkout`} className="space-y-3">
                {l.require_name && (
                  <Field name="buyer_name" label="Nombre completo" required autoComplete="name" />
                )}
                {l.require_email && (
                  <Field name="buyer_email" label="Email" type="email" required autoComplete="email" />
                )}
                {l.require_phone && (
                  <Field name="buyer_phone" label="Teléfono" type="tel" required autoComplete="tel" />
                )}
                {l.require_dni && (
                  <Field name="buyer_dni" label="DNI / CUIT" required />
                )}
                <button type="submit"
                  style={{ background: `var(--brand-bg, ${primary})` }}
                  className="w-full py-3 rounded-lg text-white font-semibold text-base hover:opacity-90 transition">
                  Pagar {(l.amount_cents / 100).toLocaleString('es-AR')} {l.currency}
                </button>
                <p className="text-[10px] text-neutral-400 text-center">
                  Pago procesado por MercadoPago. Los datos de tarjeta nunca pasan por acá.
                </p>
              </form>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <div className="text-[10px] text-neutral-400">
            Powered by <span className="font-semibold">OfferNow</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  name, label, type = 'text', required, autoComplete
}: {
  name: string; label: string; type?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <label className="block">
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">{label}{required && ' *'}</div>
      <input name={name} type={type} required={required} autoComplete={autoComplete}
        className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-500" />
    </label>
  );
}
