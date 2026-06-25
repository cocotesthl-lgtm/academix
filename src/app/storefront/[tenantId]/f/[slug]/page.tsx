import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { getServiceClient } from '@/lib/supabase/service';
import { FormRenderer, type FormDef, type FormFieldDef } from '@/components/storefront/FormRenderer';

export const dynamic = 'force-dynamic';

export default async function PublicFormPage({ params }: {
  params: Promise<{ tenantId: string; slug: string }>
}) {
  const { tenantId, slug } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: formRaw } = await (svc.from('forms') as any)
    .select('id, title, description, submit_label')
    .eq('tenant_id', tenant.id)
    .eq('slug', slug)
    .maybeSingle();
  const form = formRaw as { id: string; title: string; description: string | null; submit_label: string | null } | null;
  if (!form) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: fields } = await (svc.from('form_fields') as any)
    .select('id, position, field_type, name, label, placeholder, required, options, help_text')
    .eq('form_id', form.id)
    .order('position');

  const formDef: FormDef = {
    ...form,
    fields: (fields ?? []) as FormFieldDef[]
  };

  const primary = (tenant.brand as { primary_color?: string } | null)?.primary_color ?? '#f97316';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-16 px-6">
      <div className="max-w-xl mx-auto">
        <FormRenderer form={formDef} primary={primary} />
      </div>
    </div>
  );
}
