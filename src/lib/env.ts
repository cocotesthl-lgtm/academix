function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function optional(name: string): string | null {
  const v = process.env[name];
  return v && v.length > 0 ? v : null;
}

/**
 * Cookie domain for cross-subdomain session sharing.
 * In prod: returns ".bzseguridad.store" (or whatever rootDomain is) so
 * Supabase auth cookies set on app.* are visible on admin.*, <slug>.*, apex.
 * In dev (localhost): returns undefined → host-only cookie (browser default).
 */
function computeCookieDomain(): string | undefined {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!root) return undefined;
  if (root === 'localhost' || root.endsWith('.localhost') || root.includes(':')) return undefined;
  // Strip any leading dot the user accidentally typed
  const clean = root.replace(/^\.+/, '');
  return `.${clean}`;
}

/**
 * Origin canónico para URLs internas server-to-server (webhooks, OAuth
 * callbacks, etc). SIEMPRE devuelve https://app.<rootDomain> en prod,
 * porque ese es el subdominio donde corre la API y el dashboard del
 * owner. En dev cae al appUrl.
 *
 * Importante: appUrl puede estar configurado al apex (ej: bzseguridad.store)
 * para que la landing marketing funcione, pero el apex no necesariamente
 * resuelve /api/* correctamente. Por eso esta función fuerza app.<root>.
 */
function computePlatformApiOrigin(): string {
  const appUrlRaw = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com';
  try {
    const u = new URL(appUrlRaw);
    if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost')) {
      // dev: appUrl es directamente la base
      return appUrlRaw.replace(/\/$/, '');
    }
    // prod: forzar https://app.<rootDomain>
    return `${u.protocol}//app.${root}`;
  } catch {
    return `https://app.${root}`;
  }
}

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com',
  cookieDomain: computeCookieDomain(),
  /**
   * Origin de la API/dashboard de la plataforma (app.<root>).
   * Usar SIEMPRE este para webhooks y callbacks, NUNCA appUrl directo.
   */
  platformApiOrigin: computePlatformApiOrigin(),

  supabase: {
    url: () => required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: () => required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY')
  },

  upstash: {
    url: () => optional('UPSTASH_REDIS_REST_URL'),
    token: () => optional('UPSTASH_REDIS_REST_TOKEN')
  },

  cookies: {
    affiliateSecret: () => required('AFFILIATE_COOKIE_SECRET')
  }
};

/**
 * Origin público del storefront de un tenant.
 * Prod: https://<slug>.<rootDomain> · Dev: http://<slug>.localhost:<port>
 * Centraliza la lógica que estaba duplicada en 5+ archivos.
 */
export function tenantOrigin(slug: string): string {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com';
  try {
    const u = new URL(env.appUrl);
    const isLocal = u.hostname === 'localhost' || u.hostname.endsWith('.localhost');
    if (isLocal) {
      return `${u.protocol}//${slug}.localhost${u.port ? ':' + u.port : ''}`;
    }
    return `${u.protocol}//${slug}.${root}`;
  } catch {
    return `https://${slug}.${root}`;
  }
}

export const RESERVED_SLUGS = new Set([
  'admin', 'app', 'www', 'api', 'static', 'cdn', 'assets',
  'auth', 'login', 'signup', 'help', 'support', 'docs',
  'mail', 'email', 'blog', 'status', 'about', 'contact'
]);
