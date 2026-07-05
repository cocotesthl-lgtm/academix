import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { GiftCardRedeemPanel } from '@/components/storefront/products/GiftCardRedeemPanel';

export const dynamic = 'force-dynamic';

type GiftCardPublic = {
  id: string;
  code: string;
  amount_cents: number;
  currency: string;
  recipient_name: string | null;
  sender_name: string | null;
  message: string | null;
  expires_at: string | null;
  status: 'active' | 'redeemed' | 'expired' | 'cancelled';
  tenant_id: string;
};

function formatMoney(cents: number, currency = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(cents / 100);
}

export default async function GiftCardLandingPage({
  params
}: {
  params: Promise<{ tenantId: string; code: string }>;
}) {
  const { tenantId, code } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('gift_cards') as any)
    .select('id, code, amount_cents, currency, recipient_name, sender_name, message, expires_at, status, tenant_id')
    .eq('code', code.toUpperCase()).maybeSingle();
  const card = data as GiftCardPublic | null;

  // La card puede ser de otro tenant si el usuario escaneó y llegó al tenant equivocado.
  const wrongTenant = card && card.tenant_id !== tenantId;
  const expired = card?.expires_at && new Date(card.expires_at) < new Date();
  const notUsable = !card || wrongTenant || expired || card.status !== 'active';

  return (
    <article className="max-w-2xl mx-auto px-6 py-12">
      <div className="text-center mb-8">
        <div className="text-6xl mb-3">🎁</div>
        <h1 className="text-3xl font-bold mb-2">Gift Card</h1>
        <p className="text-black/55">Tenés un regalo esperando</p>
      </div>

      {!card ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
          <div className="text-2xl mb-3">🚫</div>
          <h2 className="font-bold text-rose-700 mb-1">Código no encontrado</h2>
          <p className="text-sm text-rose-600/80">
            Verificá que el código sea correcto o pedile al remitente una nueva imagen del QR.
          </p>
          <div className="mt-6">
            <Link href="/" className="text-sm text-blue-600 hover:underline">← Volver al inicio</Link>
          </div>
        </div>
      ) : wrongTenant ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <div className="text-2xl mb-3">⚠️</div>
          <h2 className="font-bold text-amber-700 mb-1">Esta card es de otro sitio</h2>
          <p className="text-sm text-amber-600/80">
            La gift card está emitida por otro negocio. Buscá en el diseño de la tarjeta la URL correcta para canjearla.
          </p>
        </div>
      ) : expired ? (
        <ExpiredCard card={card} />
      ) : card.status === 'redeemed' ? (
        <RedeemedCard card={card} />
      ) : card.status === 'cancelled' ? (
        <CancelledCard card={card} />
      ) : (
        <ActiveCard card={card} tenantId={tenantId} tenantName={tenant.name} />
      )}

      {card && !notUsable && (
        <p className="text-center text-xs text-black/40 mt-6">
          Tenant emisor: <strong>{tenant.name}</strong> · Código: <span className="font-mono">{card.code}</span>
        </p>
      )}
    </article>
  );
}

function ActiveCard({ card, tenantId, tenantName }: { card: GiftCardPublic; tenantId: string; tenantName: string }) {
  return (
    <div className="rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-50 to-amber-50 p-8">
      {card.recipient_name && (
        <p className="text-sm text-black/60 mb-1">Para <strong className="text-black/85">{card.recipient_name}</strong></p>
      )}
      {card.sender_name && (
        <p className="text-sm text-black/60 mb-4">De <strong className="text-black/85">{card.sender_name}</strong></p>
      )}
      {card.message && (
        <div className="italic text-black/70 my-4 pl-3 border-l-2 border-emerald-400">
          &ldquo;{card.message}&rdquo;
        </div>
      )}
      <div className="text-center py-8">
        <div className="text-[10px] uppercase tracking-widest text-black/45 mb-1">Valor</div>
        <div className="text-5xl font-bold text-emerald-700">{formatMoney(card.amount_cents, card.currency)}</div>
        {card.expires_at && (
          <div className="text-xs text-black/50 mt-3">
            Válida hasta {new Date(card.expires_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        )}
      </div>

      <GiftCardRedeemPanel
        tenantId={tenantId}
        code={card.code}
        amountCents={card.amount_cents}
        currency={card.currency}
        tenantName={tenantName}
      />
    </div>
  );
}

function ExpiredCard({ card }: { card: GiftCardPublic }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-8 text-center">
      <div className="text-3xl mb-3">⏰</div>
      <h2 className="font-bold text-lg mb-2">Esta card expiró</h2>
      <p className="text-sm text-black/60">
        {card.expires_at && (
          <>Venció el {new Date(card.expires_at).toLocaleDateString('es-AR')}.</>
        )} Contactá al remitente para ver si te la pueden regenerar.
      </p>
    </div>
  );
}

function RedeemedCard({ card }: { card: GiftCardPublic }) {
  return (
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center">
      <div className="text-3xl mb-3">✓</div>
      <h2 className="font-bold text-blue-700 mb-1">Ya fue canjeada</h2>
      <p className="text-sm text-blue-600/80">
        Esta gift card por <strong>{formatMoney(card.amount_cents, card.currency)}</strong> ya se usó en una compra.
      </p>
    </div>
  );
}

function CancelledCard({ card }: { card: GiftCardPublic }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
      <div className="text-3xl mb-3">×</div>
      <h2 className="font-bold text-rose-700 mb-1">Card cancelada</h2>
      <p className="text-sm text-rose-600/80">
        Esta gift card por {formatMoney(card.amount_cents, card.currency)} fue cancelada por el emisor. Consultá con el negocio si te la pueden regenerar.
      </p>
    </div>
  );
}
