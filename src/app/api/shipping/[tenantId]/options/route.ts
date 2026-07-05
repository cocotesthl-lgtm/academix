import { NextRequest, NextResponse } from 'next/server';
import { calculateShippingOptions } from '@/lib/shipping/actions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/shipping/[tenantId]/options?province=AR-C&subtotal=250000
 * Devuelve las tarifas de envío aplicables a esa provincia + subtotal.
 * Usado por el checkout físico para poblar el selector.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const url = new URL(req.url);
  const province = url.searchParams.get('province') ?? '';
  const subtotal = Number(url.searchParams.get('subtotal') ?? '0');
  const weight = Number(url.searchParams.get('weight') ?? '0');

  if (!province) return NextResponse.json({ options: [] });

  const options = await calculateShippingOptions(tenantId, province, subtotal, weight);
  return NextResponse.json({ options });
}
