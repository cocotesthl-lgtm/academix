const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Nota: se removió el bloque `turbopack: { root: __dirname }` porque
  // en Next 16 activaba Turbopack para el build de producción, y
  // Turbopack tiene un bug conocido con env vars NEXT_PUBLIC_* que
  // no las inyecta al bundle del cliente (causaba
  // "Missing env var: NEXT_PUBLIC_SUPABASE_URL" solo al ejecutar
  // código client-side, aunque el server las leía sin problemas).
  // El build ahora usa webpack — más lento pero estable.
  // Dev sigue usando Turbopack por default (rápido y sin este bug).
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
