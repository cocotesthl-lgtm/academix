import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantById } from '@/lib/tenant/resolve';
import { TicketScanner } from '@/components/owner/tickets/Scanner';

export const dynamic = 'force-dynamic';

/**
 * Página de scanner para afiliados habilitados como "asistentes de molinete".
 *
 * Acceso:
 *  - User logueado.
 *  - Tiene membership de afiliado en este tenant.
 *  - Esa membership tiene can_validate_tickets = true.
 *
 * Si cumple las 3, mostramos el mismo TicketScanner que usa el owner —
 * el endpoint /api/tickets/validate ya resuelve permisos generales
 * (owner OR validator) así que el afiliado puede usar la misma UI.
 */
export default async function AffiliateScanPage({
  params
}: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/affiliate/validar');

  const svc = getServiceClient();
  // Defensivo: si migration 0022 no corrio, can_validate_tickets puede no
  // existir → retry sin la columna y asumir false.
  let canValidate = false;
  try {
    const { data } = await svc
      .from('memberships')
      .select('can_validate_tickets')
      .eq('tenant_id', tenantId)
      .eq('user_id', user.id)
      .eq('role', 'affiliate')
      .eq('status', 'active')
      .maybeSingle<{ can_validate_tickets: boolean }>();
    canValidate = !!data?.can_validate_tickets;
  } catch { /* migration missing */ }

  if (!canValidate) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex items-center justify-center">
        <div className="max-w-md text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-2xl font-bold">Acceso no habilitado</h1>
          <p className="text-white/65">
            Para validar entradas necesitás que el dueño de la academia te habilite como asistente de molinete.
          </p>
          <a href="/affiliate" className="inline-block rounded-md bg-white text-black px-4 py-2 text-sm font-semibold">
            ← Volver al panel
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <a href="/affiliate" className="text-xs text-white/55 hover:text-white">← Panel afiliado</a>
            <h1 className="text-2xl font-bold mt-2">Validar entradas</h1>
            <p className="text-sm text-white/55 mt-1">
              Escaneá con la pistola, la cámara, o tipeá el N° de orden.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-wider rounded-full border border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200 px-3 py-1">
            🔓 Validator de {tenant.name}
          </span>
        </div>
        <TicketScanner />
      </div>
    </div>
  );
}
