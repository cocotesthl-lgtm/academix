const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /**
   * Forzar inyección de env vars al bundle del cliente.
   *
   * Vercel autoactiva Turbopack para builds de Next 16 y tiene un
   * bug conocido: no inyecta variables NEXT_PUBLIC_* al bundle del
   * cliente aunque estén en process.env al build time. El servidor
   * las lee bien, pero el JS del cliente sale sin ellas y explotan
   * al llamar cosas como createSupabaseBrowserClient().
   *
   * La API `env` de next.config.js fuerza explícitamente la inyección.
   * Es más viejo pero funciona con cualquier bundler. Cualquier var
   * listada acá se hardcodea en el bundle del cliente como string
   * literal, ignorando bugs del bundler.
   */
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'drive.google.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }
    ]
  },
  /**
   * COOP header para Google Identity Services (popup login).
   * Sin esto, Chrome bloquea el postMessage entre Google y la ventana
   * principal — el popup no puede completar el login.
   * `same-origin-allow-popups` es lo recomendado por Google.
   */
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
