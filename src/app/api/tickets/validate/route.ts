import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { validateTicket } from '@/lib/tickets/validate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/tickets/validate
 * Body: { code: string, tenant_id?: string }
 *
 * Auth: el caller puede ser:
 *  - owner del tenant (cualquier tenant donde tenga role=owner)
 *  - afiliado con can_validate_tickets=true en el tenant del ticket
 *  - instructor con can_validate_tickets=true (si lo habilitamos en
 *    futuras versiones — por ahora solo affiliate y owner)
 *
 * Si el caller tiene varios roles en varios tenants, el endpoint resuelve
 * el tenant_id del ticket desde el qr_token y verifica que el caller
 * tenga permiso para ese tenant específico (no para CUALQUIER tenant).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
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

  const svc = getServiceClient();

  // Resolver tenant_id del ticket (lookup minimo por qr_token / order_number)
  // antes de chequear permisos, asi validamos contra el tenant correcto.
  const { parseScannerInput } = await import('@/lib/tickets/validate');
  const parsed = parseScannerInput(code);
  if (!parsed) {
    return NextResponse.json({ ok: false, status: 'not_found' });
  }
  const column = parsed.kind === 'token' ? 'qr_token' : 'order_number';
  const { data: ticketLookup } = await svc
    .from('event_tickets').select('tenant_id').eq(column, parsed.value)
    .maybeSingle<{ tenant_id: string }>();
  if (!ticketLookup) {
    return NextResponse.json({ ok: false, status: 'not_found' });
  }

  // ¿El user tiene permiso para validar tickets en ese tenant?
  // Owner: cualquier owner activo del tenant.
  // Validator: cualquier membership (owner/instructor/affiliate) con
  // can_validate_tickets=true.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let memQuery = svc.from('memberships')
    .select('role, status, can_validate_tickets')
    .eq('user_id', user.id)
    .eq('tenant_id', ticketLookup.tenant_id)
    .eq('status', 'active');
  const { data: memberships } = await memQuery as { data: Array<{ role: string; status: string; can_validate_tickets?: boolean }> | null };

  const memList = memberships ?? [];
  const isOwner = memList.some((m) => m.role === 'owner');
  const canValidate = memList.some((m) => m.can_validate_tickets === true);
  if (!isOwner && !canValidate) {
    return NextResponse.json({ ok: false, status: 'unauthorized' }, { status: 403 });
  }

  const result = await validateTicket({
    validatorUserId: user.id,
    tenantId: ticketLookup.tenant_id,
    input: code
  });
  return NextResponse.json(result);
}
