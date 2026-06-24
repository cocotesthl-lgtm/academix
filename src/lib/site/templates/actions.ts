'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { SITE_TEMPLATES } from './catalog';

/** Aplica un template completo al sitio del tenant. Pisa todo el site_config. */
export async function applySiteTemplateAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const templateId = String(formData.get('template_id') ?? '');
  const tpl = SITE_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return;

  const svc = getServiceClient();
  const patch: Record<string, unknown> = {
    site_config: tpl.config,
    updated_at: new Date().toISOString()
  };
  // Si el tenant no tiene un primary color custom (o es el default), aplicamos
  // el sugerido del template — ayuda a que el sitio se vea distinto al toque.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tRow } = await (svc.from('tenants') as any)
    .select('brand').eq('id', tenant.id).maybeSingle();
  const currentPrimary = tRow?.brand?.primary_color;
  if (!currentPrimary || currentPrimary === '#a855f7' || currentPrimary === '#0a0a0a') {
    patch.brand = { ...(tRow?.brand ?? {}), primary_color: tpl.suggestedPrimary };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update(patch).eq('id', tenant.id);
  revalidatePath('/owner/site');
  revalidatePath('/owner/templates');
  redirect('/owner/site?templateApplied=' + encodeURIComponent(tpl.name));
}
