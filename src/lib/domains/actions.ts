'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantPlan } from '@/lib/plans/queries';
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
  const root = (process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'bzseguridad.store').toLowerCase();
  if (v === root || v.endsWith('.' + root)) return null;
  return v;
}

export async function connectCustomDomainAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const domain = sanitizeDomain(String(formData.get('domain') ?? ''));
  if (!domain) {
    redirect('/dominio?error=invalid_domain');
  }

  // ENFORCEMENT: chequear plan antes de permitir conectar dominio.
  // Si plan.features.domains_max === 0 → bloqueamos.
  const tenantPlan = await getTenantPlan(tenant.id);
  const allowed = tenantPlan.plan?.features?.domains_max ?? 0;
  if (allowed === 0) {
    redirect('/dominio?error=plan_no_domains');
  }
  // Si ya tiene un dominio conectado y el plan solo permite N, bloqueamos
  // (por ahora limitamos a 1 — futuro: multi-domain con tenant_domains tabla)
  const svc = getServiceClient();
  const { data: existing } = await svc.from('tenants')
    .select('custom_domain').eq('id', tenant.id).maybeSingle<{ custom_domain: string | null }>();
  if (existing?.custom_domain && existing.custom_domain !== domain) {
    // Ya tiene uno conectado — debe desconectar primero
    redirect('/dominio?error=already_connected');
  }

  // Update tenant.custom_domain
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    custom_domain: domain,
    updated_at: new Date().toISOString()
  }).eq('id', tenant.id);

  // Llamar a Vercel API para agregarlo al proyecto.
  // IMPORTANTE: SIEMPRE seteamos vercel_verified=false en la conexión
  // inicial. El owner debe configurar DNS + apretar "Verificar ahora"
  // para que pase a verified=true. Esto evita el bug previo donde Vercel
  // a veces respondía verified=true sin que el DNS esté realmente OK.
  let apex: string | undefined;
  let cname: string | undefined;
  let vercelRaw: unknown = { skipped: 'no_token' };
  let vercelError: string | null = null;
  if (process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID) {
    try {
      const status = await addDomainToVercel(domain);
      apex = status.apexValue;
      cname = status.cnameTarget;
      vercelRaw = status.raw;
    } catch (e) {
      vercelError = e instanceof Error ? e.message : 'unknown';
      vercelRaw = { error: vercelError };
    }
  }

  // Guardar estado — SIEMPRE como no-verificado en la conexión inicial.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenant_domain_status') as any).upsert({
    tenant_id: tenant.id,
    domain,
    vercel_verified: false,
    vercel_apex_a_record: apex ?? '76.76.21.21',
    vercel_cname_target: cname ?? 'cname.vercel-dns.com',
    last_checked_at: new Date().toISOString(),
    vercel_response: vercelRaw,
    updated_at: new Date().toISOString()
  }, { onConflict: 'tenant_id' });

  if (vercelError) {
    redirect(`/dominio?error=vercel_failed&msg=${encodeURIComponent(vercelError)}`);
  }
  redirect('/dominio?ok=connected');
}

export async function verifyCustomDomainAction(): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // Buscar dominio actual
  const { data } = await svc.from('tenants').select('custom_domain')
    .eq('id', tenant.id).maybeSingle<{ custom_domain: string | null }>();
  if (!data?.custom_domain) return;

  if (!process.env.VERCEL_API_TOKEN) {
    redirect('/dominio?error=vercel_not_configured');
  }
  try {
    const status = await verifyDomain(data.custom_domain);
    // Verificación real: solo trustamos verified=true si Vercel lo dice
    // explícitamente Y no hay errores en el verification array.
    const reallyVerified = status.verified && (!status.verification || status.verification.length === 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (svc.from('tenant_domain_status') as any).upsert({
      tenant_id: tenant.id,
      domain: data.custom_domain,
      vercel_verified: reallyVerified,
      vercel_apex_a_record: status.apexValue ?? '76.76.21.21',
      vercel_cname_target: status.cnameTarget ?? 'cname.vercel-dns.com',
      last_checked_at: new Date().toISOString(),
      vercel_response: status.raw,
      updated_at: new Date().toISOString()
    }, { onConflict: 'tenant_id' });
    if (!reallyVerified) {
      redirect('/dominio?error=dns_not_propagated');
    }
  } catch (e) {
    console.error('[verifyCustomDomain]', e);
    redirect('/dominio?error=verify_failed');
  }
  redirect('/dominio?ok=verified');
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
