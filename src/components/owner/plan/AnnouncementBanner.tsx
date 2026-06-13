/**
 * Banner promocional renderizado en el OwnerLayout cuando el founder
 * tiene uno activo (no expirado + plan match).
 *
 * Lo muestra una sola vez por sesión via sessionStorage — si el owner
 * lo cierra, no vuelve a aparecer hasta el próximo login.
 */
'use client';

import { useEffect, useState } from 'react';

export type AnnouncementBannerData = {
  id: string;
  title: string;
  message: string;
  cta_label: string | null;
  cta_href: string | null;
  promo_code: string | null;
  bg_color: string;
  text_color: string;
};

export function AnnouncementBanner({ banner }: { banner: AnnouncementBannerData }) {
  const [visible, setVisible] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const dismissed = sessionStorage.getItem(`banner-dismissed-${banner.id}`);
      if (dismissed === '1') setVisible(false);
    } catch { /* sessionStorage disabled */ }
  }, [banner.id]);

  if (!mounted || !visible) return null;

  function dismiss() {
    setVisible(false);
    try { sessionStorage.setItem(`banner-dismissed-${banner.id}`, '1'); } catch { /* ignore */ }
  }

  return (
    <div
      className="rounded-lg px-4 py-3 flex items-center gap-3 flex-wrap shadow-lg"
      style={{ background: banner.bg_color, color: banner.text_color }}
    >
      <div className="flex-1 min-w-0">
        <strong className="text-sm block">{banner.title}</strong>
        <span className="text-xs opacity-85">{banner.message}</span>
        {banner.promo_code && (
          <span className="text-[10px] uppercase tracking-wider opacity-80 ml-2">
            Código: <span className="font-mono font-bold">{banner.promo_code}</span>
          </span>
        )}
      </div>
      {banner.cta_label && banner.cta_href && (
        <a
          href={banner.cta_href}
          className="rounded bg-black/20 hover:bg-black/30 px-4 py-1.5 text-xs font-semibold whitespace-nowrap"
        >
          {banner.cta_label} →
        </a>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="w-7 h-7 grid place-items-center rounded hover:bg-black/20 text-sm shrink-0"
      >
        ✕
      </button>
    </div>
  );
}
