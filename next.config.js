const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: {
    root: __dirname
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
