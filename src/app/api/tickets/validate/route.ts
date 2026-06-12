import { NextRequest, NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guards';
import { validateTicket } from '@/lib/tickets/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/tickets/validate
 * Body: { code: string }
 *
 * Llamada por el scanner del owner. Auth via session (cookie supabase) +
 * resolución de tenant via requireOwner. Devuelve JSON con resultado para
 * pintar el feedback en la UI (verde = válido, rojo = ya usado / inválido).
 */
export async function POST(req: NextRequest) {
  let userId: string;
  let tenantId: string;
  try {
    const ctx = await requireOwner();
    userId = ctx.userId;
    tenantId = ctx.tenant.id;
  } catch {
    return NextResponse.json({ ok: false, status: 'unauthorized' }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, status: 'not_found' }, { status: 400 });
  }
  const code = String(body.code ?? '').trim();
  if (!code) {
    return NextResponse.json({ ok: false, status: 'not_found' }, { status: 400 });
  }

  const result = await validateTicket({
    validatorUserId: userId,
    tenantId,
    input: code
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 200 });
}
