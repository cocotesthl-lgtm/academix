import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { csvString, csvFilename } from '@/lib/csv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Descarga CSV de clientes (enrollments) del tenant.
 * Solo el owner puede.
 *
 * Columnas: fecha, nombre, dni, email, telefono, ubicación, publicación,
 * estado, fecha booking. Hasta 5000 filas (límite operativo).
 */
export async function GET() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: enrollmentsRaw } = await svc
    .from('enrollments')
    .select('id, course_id, user_id, status, created_at, buyer_name, buyer_dni, buyer_location, buyer_email, buyer_phone, booking_date')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(5000);
  const enrollments = (enrollmentsRaw ?? []) as Array<{
    id: string; course_id: string; user_id: string; status: string; created_at: string;
    buyer_name: string | null; buyer_dni: string | null; buyer_location: string | null;
    buyer_email: string | null; buyer_phone: string | null; booking_date: string | null;
  }>;

  // Publicaciones para mostrar nombre legible
  const courseIds = Array.from(new Set(enrollments.map((e) => e.course_id)));
  let courseMap = new Map<string, string>();
  if (courseIds.length > 0) {
    const { data: courses } = await svc
      .from('courses').select('id, title').in('id', courseIds);
    courseMap = new Map(((courses ?? []) as Array<{ id: string; title: string }>).map((c) => [c.id, c.title]));
  }

  // Profiles fallback para email/nombre cuando buyer_* no tiene
  const userIds = Array.from(new Set(enrollments.map((e) => e.user_id).filter(Boolean)));
  let profileMap = new Map<string, { email: string | null; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await svc
      .from('profiles').select('id, email, display_name').in('id', userIds);
    profileMap = new Map(((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>)
      .map((p) => [p.id, { email: p.email, display_name: p.display_name }]));
  }

  const headers = ['Fecha', 'Nombre', 'DNI', 'Email', 'Telefono', 'Ubicacion', 'Publicación', 'Estado', 'Fecha booking'];
  const rows = enrollments.map((e) => {
    const p = profileMap.get(e.user_id);
    return [
      new Date(e.created_at).toLocaleDateString('es-AR'),
      e.buyer_name ?? p?.display_name ?? '',
      e.buyer_dni ?? '',
      e.buyer_email ?? p?.email ?? '',
      e.buyer_phone ?? '',
      e.buyer_location ?? '',
      courseMap.get(e.course_id) ?? '',
      e.status,
      e.booking_date ?? ''
    ];
  });

  const csv = csvString(headers, rows);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('clientes', tenant.slug)}"`
    }
  });
}
