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

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'curplat.com',
  cookieDomain: computeCookieDomain(),

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

export const RESERVED_SLUGS = new Set([
  'admin', 'app', 'www', 'api', 'static', 'cdn', 'assets',
  'auth', 'login', 'signup', 'help', 'support', 'docs',
  'mail', 'email', 'blog', 'status', 'about', 'contact'
]);
