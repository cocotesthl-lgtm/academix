'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { addDomainToVercel, removeDomainFromVercel, verifyDomain } from './vercel';

/**
 * Actions del owner para gestionar su dominio custom.
 * Defensivo: si Vercel API no está configurada, guarda en DB pero
 * marca como no verificado.
 */

function sanitizeDomain(raw: string): string | null {
  const v = raw.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/\s/g, '');
  if (!v) return null;
  // Regex básico de dominio (acepta subdominios)
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v)) return null;
  if (v.length > 253) return null;
  // Bloqueamos el rootDomain de la plataforma + sus subdominios
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com').toLowerCase();
  if (v === root || v.endsWith('.' + root)) return null;
  return v;
}

export async function connectCustomDomainAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const domain = sanitizeDomain(String(formData.get('domain') ?? ''));
  if (!domain) {
    revalidatePath('/dominio');
    return;
  }
  const svc = getServiceClient();
  // Update tenant.custom_domain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    custom_domain: domain,
    updated_at: new Date().toISOString()
  }).eq('id', tenant.id);

  // Llamar a Vercel API para agregarlo al proyecto
  let verified = false;
  let apex: string | undefined;
  let cname: string | undefined;
  let vercelRaw: unknown = { skipped: 'no_token' };
  if (process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID) {
    try {
      const status = await addDomainToVercel(domain);
      verified = status.verified;
      apex = status.apexValue;
      cname = status.cnameTarget;
      vercelRaw = status.raw;
    } catch (e) {
      vercelRaw = { error: e instanceof Error ? e.message : 'unknown' };
    }
  }

  // Guardar estado de verificación
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenant_domain_status') as any).upsert({
    tenant_id: tenant.id,
    domain,
    vercel_verified: verified,
    vercel_apex_a_record: apex ?? '76.76.21.21',
    vercel_cname_target: cname ?? 'cname.vercel-dns.com',
    last_checked_at: new Date().toISOString(),
    vercel_response: vercelRaw,
    updated_at: new Date().toISOString()
  }, { onConflict: 'tenant_id' });

  revalidatePath('/dominio');
}

export async function verifyCustomDomainAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // Buscar dominio actual
  const { data } = await svc.from('tenants').select('custom_domain')
    .eq('id', tenant.id).maybeSingle<{ custom_domain: string | null }>();
  if (!data?.custom_domain) return;

  if (!process.env.VERCEL_API_TOKEN) {
    revalidatePath('/dominio');
    return;
  }
  try {
    const status = await verifyDomain(data.custom_domain);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenant_domain_status') as any).upsert({
      tenant_id: tenant.id,
      domain: data.custom_domain,
      vercel_verified: status.verified,
      vercel_apex_a_record: status.apexValue ?? '76.76.21.21',
      vercel_cname_target: status.cnameTarget ?? 'cname.vercel-dns.com',
      last_checked_at: new Date().toISOString(),
      vercel_response: status.raw,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });
  } catch (e) {
    console.error('[verifyCustomDomain]', e);
  }
  revalidatePath('/dominio');
}

export async function disconnectCustomDomainAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc.from('tenants').select('custom_domain')
    .eq('id', tenant.id).maybeSingle<{ custom_domain: string | null }>();
  if (data?.custom_domain && process.env.VERCEL_API_TOKEN) {
    try { await removeDomainFromVercel(data.custom_domain); } catch (e) {
      console.error('[disconnectCustomDomain]', e);
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    custom_domain: null,
    updated_at: new Date().toISOString()
  }).eq('id', tenant.id);
  await svc.from('tenant_domain_status').delete().eq('tenant_id', tenant.id);
  revalidatePath('/dominio');
}

/** Toggle "aparecer en marketplace público". */
export async function togglePublicListingAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const isPublic = formData.get('is_public') === 'true';
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    public_listing: isPublic,
    updated_at: new Date().toISOString()
  }).eq('id', tenant.id);
  revalidatePath('/branding');
  revalidatePath('/dominio');
}
