'use client';

/**
 * Helper cliente para trackear eventos. Fire-and-forget: no bloquea navegación,
 * no muestra errores, no reintenta. Si el endpoint falla, se pierde el evento.
 * (Analytics es best-effort — no queremos afectar UX del comprador.)
 *
 * Session ID se guarda en localStorage bajo 'curplat_analytics_sid' y sobrevive
 * navegación entre páginas y visitas repetidas.
 */

const SID_KEY = 'curplat_analytics_sid';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = localStorage.getItem(SID_KEY);
  if (!sid) {
    // uuid v4 sintético — no necesita ser cryptográficamente perfecto
    sid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    try { localStorage.setItem(SID_KEY, sid); } catch { /* privacy mode */ }
  }
  return sid;
}

function utmParams(): { utm_source?: string; utm_medium?: string; utm_campaign?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  const s = params.get('utm_source'); if (s) out.utm_source = s;
  const m = params.get('utm_medium'); if (m) out.utm_medium = m;
  const c = params.get('utm_campaign'); if (c) out.utm_campaign = c;
  return out;
}

export type AnalyticsEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'checkout_start'
  | 'purchase';

export function trackEvent(
  tenantId: string,
  eventType: AnalyticsEventType,
  extra: {
    product_id?: string;
    order_id?: string;
    amount_cents?: number;
    path?: string;
  } = {}
): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event_type: eventType,
    session_id: getSessionId(),
    path: extra.path ?? window.location.pathname,
    ...utmParams(),
    ...extra
  };
  // sendBeacon si está disponible → sobrevive al unload del tab (por ej. después de "Ir al checkout" y redirect a MP).
  try {
    const url = `/api/track/${tenantId}`;
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => { /* fire-and-forget */ });
  } catch { /* window sin fetch/beacon (raro) */ }
}
