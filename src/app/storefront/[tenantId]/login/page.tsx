import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Login del storefront — ahora redirige al login GLOBAL de la plataforma
 * (app.<root>/login) que es donde vive Google Identity Services (popup
 * in-site sin salir del ecosistema).
 *
 * Google no acepta wildcards en Authorized JavaScript origins, así que
 * no podemos poner un botón GIS en cada subdomain de tenant — sería
 * insostenible tener que agregar cada tenant a mano.
 *
 * Solución: un único login (app.<root>) que sirve a todo el ecosistema.
 * Después de autenticar, el usuario vuelve al tenant vía `next` param.
 *
 * Patrón usado por Notion, Vercel, Slack, Figma, etc.
 */
export default async function StorefrontLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { tenantId } = await params;
  const { next: incomingNext } = await searchParams;

  // Reconstruir la URL absoluta a la que volver post-login. Si vino con
  // ?next=… respetarlo (relativo al tenant); sino, mandar a /learn como
  // fallback razonable para compradores.
  const hdrs = await headers();
  const host = hdrs.get('host') ?? '';
  const proto = hdrs.get('x-forwarded-proto') ?? 'https';
  const tenantOrigin = `${proto}://${host}`;
  const nextPath = incomingNext && incomingNext.startsWith('/') ? incomingNext : '/learn';
  const nextAbsolute = `${tenantOrigin}${nextPath}`;

  // URL absoluta al login global
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.localhost');
  const globalHost = isLocal
    ? `app.localhost${appUrl.port ? ':' + appUrl.port : ''}`
    : `app.${env.rootDomain}`;
  const target = `${appUrl.protocol}//${globalHost}/login?next=${encodeURIComponent(nextAbsolute)}&tenant=${encodeURIComponent(tenantId)}`;

  redirect(target);
}
