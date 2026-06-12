import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { csvString, csvFilename } from '@/lib/csv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Descarga CSV de ventas (sales) del tenant.
 * Solo el owner puede. Hasta 5000 filas.
 */
export async function GET() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: salesRaw } = await svc
    .from('sales')
    .select('id, occurred_at, course_id, buyer_name, buyer_email, buyer_phone, buyer_dni, amount_gross_cents, currency, status, external_provider, external_id')
    .eq('tenant_id', tenant.id)
    .order('occurred_at', { ascending: false })
    .limit(5000);
  const sales = (salesRaw ?? []) as Array<{
    id: string; occurred_at: string; course_id: string | null;
    buyer_name: string | null; buyer_email: string | null; buyer_phone: string | null; buyer_dni: string | null;
    amount_gross_cents: number; currency: string; status: string;
    external_provider: string; external_id: string;
  }>;

  const courseIds = Array.from(new Set(sales.map((s) => s.course_id).filter((c): c is string => !!c)));
  let courseMap = new Map<string, string>();
  if (courseIds.length > 0) {
    const { data: courses } = await svc.from('courses').select('id, title').in('id', courseIds);
    courseMap = new Map(((courses ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
  }

  const headers = ['Fecha', 'Hora', 'Cliente', 'Email', 'Telefono', 'DNI', 'Curso', 'Monto', 'Moneda', 'Estado', 'Proveedor', 'ID externo'];
  const rows = sales.map((s) => {
    const d = new Date(s.occurred_at);
    return [
      d.toLocaleDateString('es-AR'),
      d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
      s.buyer_name ?? '',
      s.buyer_email ?? '',
      s.buyer_phone ?? '',
      s.buyer_dni ?? '',
      s.course_id ? (courseMap.get(s.course_id) ?? '') : '',
      (s.amount_gross_cents / 100).toFixed(2),
      s.currency,
      s.status,
      s.external_provider,
      s.external_id
    ];
  });

  const csv = csvString(headers, rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('ventas', tenant.slug)}"`
    }
  });
}
