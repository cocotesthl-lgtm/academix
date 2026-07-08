import { notFound } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { updatePromotionAction } from '@/lib/promotions/actions';
import type { Promotion } from '@/lib/promotions/types';
import { PromotionForm } from '@/components/owner/promotions/PromotionForm';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

export default async function EditPromotionPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: promo } = await (svc.from('promotions') as any)
    .select('*').eq('id', id).eq('tenant_id', tenant.id).maybeSingle();
  if (!promo) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cats } = await (svc.from('course_categories') as any)
    .select('id, name').eq('tenant_id', tenant.id).order('position', { ascending: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: prods } = await (svc.from('physical_products') as any)
    .select('id, title').eq('tenant_id', tenant.id).eq('status', 'published')
    .order('updated_at', { ascending: false }).limit(200);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar promoción"
        description="Cambiá parámetros, scope o vigencia. Los cambios se aplican al toque en el carrito."
        back={{ label: '← Promociones', href: '/promotions' }}
      />
      <PromotionForm
        action={updatePromotionAction}
        promotion={promo as Promotion}
        categories={(cats ?? []) as Array<{ id: string; name: string }>}
        products={(prods ?? []) as Array<{ id: string; title: string }>}
        isEdit
      />
    </div>
  );
}
