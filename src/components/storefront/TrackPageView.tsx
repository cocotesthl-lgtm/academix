'use client';

import { useEffect } from 'react';
import { trackEvent, type AnalyticsEventType, type ContentKind } from '@/lib/analytics/client';

/**
 * Dispatcha un evento al montar. Se usa desde server components envolviendo
 * la data que quieren trackear. Renderiza null — es puramente un side-effect.
 */
export function TrackPageView({
  tenantId,
  eventType = 'page_view',
  productId,
  orderId,
  amountCents,
  contentKind
}: {
  tenantId: string;
  eventType?: AnalyticsEventType;
  productId?: string;
  orderId?: string;
  amountCents?: number;
  /** Tipo de contenido cuando el evento se refiere a un item del catálogo. */
  contentKind?: ContentKind;
}) {
  useEffect(() => {
    trackEvent(tenantId, eventType, {
      product_id: productId,
      order_id: orderId,
      amount_cents: amountCents,
      content_kind: contentKind
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
