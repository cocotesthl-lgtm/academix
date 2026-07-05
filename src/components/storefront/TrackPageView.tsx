'use client';

import { useEffect } from 'react';
import { trackEvent, type AnalyticsEventType } from '@/lib/analytics/client';

/**
 * Dispatcha un evento al montar. Se usa desde server components envolviendo
 * la data que quieren trackear. Renderiza null — es puramente un side-effect.
 */
export function TrackPageView({
  tenantId,
  eventType = 'page_view',
  productId,
  orderId,
  amountCents
}: {
  tenantId: string;
  eventType?: AnalyticsEventType;
  productId?: string;
  orderId?: string;
  amountCents?: number;
}) {
  useEffect(() => {
    trackEvent(tenantId, eventType, {
      product_id: productId,
      order_id: orderId,
      amount_cents: amountCents
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
