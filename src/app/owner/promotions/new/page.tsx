import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { createPromotionAction } from '@/lib/promotions/actions';
import { PromotionForm } from '@/components/owner/promotions/PromotionForm';
import { PageHeader } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

export default async function NewPromotionPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Cargar categorías + productos (para el picker de scope)
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
        title="Nueva promoción"
        description="Regla automática que se aplica al carrito cuando el cliente cumple la condición."
        back={{ label: '← Promociones', href: '/promotions' }}
      />
      <PromotionForm
        action={createPromotionAction}
        categories={(cats ?? []) as Array<{ id: string; name: string }>}
        products={(prods ?? []) as Array<{ id: string; title: string }>}
      />
    </div>
  );
}
