import { NextRequest, NextResponse } from 'next/server';
import { findPromoCode } from '@/lib/plans/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Validar un código promo desde el cliente.
 * No requiere auth (es lookup público) — pero retorna minimal info,
 * la validación final + apply se hace en server al confirmar el pago.
 *
 * GET /api/plans/validate-promo?code=XYZ
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ ok: false, error: 'code_required' }, { status: 400 });

  const promo = await findPromoCode(code);
  if (!promo) return NextResponse.json({ ok: false, error: 'not_found' });
  if (!promo.is_active) return NextResponse.json({ ok: false, error: 'paused' });

  // Expirado
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'expired' });
  }
  // Cupo agotado
  if (promo.max_uses !== null && promo.used_count >= promo.max_uses) {
    return NextResponse.json({ ok: false, error: 'maxed_out' });
  }

  return NextResponse.json({
    ok: true,
    code: promo.code,
    discount_type: promo.discount_type,
    discount_value: promo.discount_value,
    plan_ids: promo.plan_ids,        // vacío = todos
    applies_to: promo.applies_to     // 'monthly' | 'annual' | 'both'
  });
}
