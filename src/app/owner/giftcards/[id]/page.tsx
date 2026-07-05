import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { env } from '@/lib/env';
import { GiftCardDetail } from '@/components/owner/giftcards/GiftCardDetail';
import type { GiftCard } from '@/lib/giftcards/actions';

export const dynamic = 'force-dynamic';

export default async function GiftCardDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('gift_cards') as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  const card = data as GiftCard | null;
  if (!card) notFound();

  // URL pública que va en el QR
  const u = new URL(env.appUrl);
  const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
  const host = isLocal
    ? `${tenant.slug}.localhost${u.port ? ':' + u.port : ''}`
    : `${tenant.slug}.${env.rootDomain}`;
  const publicUrl = `${u.protocol}//${host}/gc/${card.code}`;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/giftcards" className="text-white/50 hover:text-white text-sm">← Gift cards</Link>
        <span className="text-white/30">/</span>
        <span className="font-mono text-sm">{card.code}</span>
      </div>

      <GiftCardDetail card={card} publicUrl={publicUrl} tenantName={tenant.name} />
    </div>
  );
}
