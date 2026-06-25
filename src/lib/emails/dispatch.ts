import 'server-only';
import QRCode from 'qrcode';
import { getServiceClient } from '@/lib/supabase/service';
import { tenantOrigin, env } from '@/lib/env';
import { ticketQrUrl } from '@/lib/tickets/codes';
import { sendEmail } from './client';
import {
  purchaseConfirmedEmail,
  eventTicketConfirmedEmail,
  bookingConfirmedEmail,
  bookingRescheduledEmail,
  instructorWelcomeEmail,
  vipNewContentEmail
} from './templates';

/**
 * Dispatchers de email — funciones de alto nivel que el resto del código
 * llama después de un evento de negocio (compra confirmada, ticket emitido,
 * reserva reagendada). Cada dispatcher:
 *  1) Carga los datos necesarios de DB (tenant brand, curso, etc).
 *  2) Renderiza el template.
 *  3) Llama a sendEmail.
 *  4) NUNCA tira excepción — captura todo y loguea.
 *
 * El caller (webhook MP, action de reschedule, etc) puede invocar sin try/
 * catch porque acá ya se contiene cualquier fallo.
 */

type TenantBrand = {
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor: string;
  emailHeaderImageUrl?: string;
  emailBannerImageUrl?: string;
  emailFooterMessage?: string;
};

async function loadTenantBrand(tenantId: string): Promise<TenantBrand | null> {
  const svc = getServiceClient();
  // Defensivo: si migration 0021 no corrió, las columnas email_* no existen
  // → reintentamos con el set basico.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try {
    const res = await svc
      .from('tenants')
      .select('name, slug, brand, email_header_image_url, email_banner_image_url, email_footer_message')
      .eq('id', tenantId)
      .maybeSingle();
    if (res.error) throw res.error;
    data = res.data;
  } catch {
    const res = await svc
      .from('tenants').select('name, slug, brand').eq('id', tenantId).maybeSingle();
    data = res.data;
  }
  if (!data) return null;
  return {
    name: data.name,
    slug: data.slug,
    logoUrl: data.brand?.logo_url,
    primaryColor: data.brand?.primary_color || '#f97316',
    emailHeaderImageUrl: data.email_header_image_url || undefined,
    emailBannerImageUrl: data.email_banner_image_url || undefined,
    emailFooterMessage: data.email_footer_message || undefined
  };
}

/** Spread del brand → opciones de layout (sin duplicar en cada dispatcher). */
function brandToLayout(brand: TenantBrand) {
  return {
    brandName: brand.name,
    brandColor: brand.primaryColor,
    logoUrl: brand.logoUrl,
    emailHeaderImageUrl: brand.emailHeaderImageUrl,
    emailBannerImageUrl: brand.emailBannerImageUrl,
    emailFooterMessage: brand.emailFooterMessage
  };
}

function formatAmount(cents: number, currency: string): string {
  const value = (cents / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 });
  return `${currency} ${value}`;
}

/** Después de confirmar una compra de curso */
/**
 * Notifica a todos los enrolled de un pack VIP que se agregó contenido nuevo.
 * Se llama al final de addMediaItemAction. Manda en paralelo, no bloquea.
 */
export async function notifyVipNewContent(opts: {
  tenantId: string;
  courseId: string;
  itemTitle?: string;
  itemType: 'image' | 'video' | 'audio' | 'embed';
  itemCount?: number;
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const svc = getServiceClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: course } = await (svc.from('courses') as any)
      .select('title, slug, product_type').eq('id', opts.courseId)
      .maybeSingle();
    if (!course || course.product_type !== 'vip_pack') return;

    // Sacar emails de todos los enrolled (vía profiles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: enrolled } = await (svc.from('enrollments') as any)
      .select('user_id, profiles ( email )').eq('course_id', opts.courseId);
    const emails: string[] = [];
    for (const e of (enrolled ?? []) as Array<{ profiles: { email: string | null } | null }>) {
      const em = e.profiles?.email;
      if (em && !emails.includes(em)) emails.push(em);
    }
    if (emails.length === 0) return;

    const origin = tenantOrigin(brand.slug);
    const { subject, html } = vipNewContentEmail({
      ...brandToLayout(brand),
      packTitle: course.title,
      itemTitle: opts.itemTitle,
      itemType: opts.itemType,
      itemCount: opts.itemCount ?? 1,
      accessUrl: `${origin}/c/${course.slug}`
    });
    // Mandamos en paralelo. No esperamos todos para no bloquear el commit.
    await Promise.all(emails.slice(0, 100).map((to) => sendEmail({ to, subject, html })));
  } catch (e) {
    console.error('[emails] notifyVipNewContent falló:', e);
  }
}

export async function notifyPurchaseConfirmed(opts: {
  tenantId: string;
  courseId: string;
  buyerEmail: string;
  buyerName?: string | null;
  amountCents: number;
  currency: string;
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const svc = getServiceClient();
    const { data: course } = await svc
      .from('courses')
      .select('title, slug')
      .eq('id', opts.courseId)
      .maybeSingle<{ title: string; slug: string }>();
    if (!course) return;

    const origin = tenantOrigin(brand.slug);
    const { subject, html } = purchaseConfirmedEmail({
      ...brandToLayout(brand),
      buyerName: opts.buyerName ?? undefined,
      buyerEmail: opts.buyerEmail,
      courseTitle: course.title,
      amountFormatted: formatAmount(opts.amountCents, opts.currency),
      accessUrl: `${origin}/account`
    });
    await sendEmail({ to: opts.buyerEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyPurchaseConfirmed falló:', e);
  }
}

/** Después de confirmar tickets de evento */
export async function notifyEventTicketsConfirmed(opts: {
  tenantId: string;
  courseId: string;
  buyerEmail: string;
  buyerName?: string | null;
  ticketsCount: number;
  amountCents: number;
  currency: string;
  eventDate?: string | null;           // ISO date "2026-07-12"
  seats?: string[];                    // ["VIP A1"]
  ticketIds?: string[];                // ids de event_tickets para generar QRs
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const svc = getServiceClient();
    const { data: course } = await svc
      .from('courses')
      .select('title, slug')
      .eq('id', opts.courseId)
      .maybeSingle<{ title: string; slug: string }>();
    if (!course) return;

    const origin = tenantOrigin(brand.slug);
    const dateStr = opts.eventDate
      ? new Date(opts.eventDate).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
      : 'A definir';

    // Generar QRs por ticket (si tenemos ids)
    let qrTickets: Array<{ qrDataUrl: string; orderNumber: string; seatLabel?: string | null }> | undefined;
    if (opts.ticketIds && opts.ticketIds.length > 0) {
      const { data: tRows } = await svc
        .from('event_tickets')
        .select('qr_token, order_number, seat_label')
        .in('id', opts.ticketIds);
      const rows = (tRows ?? []) as Array<{ qr_token: string | null; order_number: string | null; seat_label: string | null }>;
      qrTickets = await Promise.all(rows.filter((r) => r.qr_token).map(async (r) => {
        const url = ticketQrUrl(r.qr_token!, env.platformApiOrigin);
        const qrDataUrl = await QRCode.toDataURL(url, {
          width: 220, margin: 1, errorCorrectionLevel: 'M',
          color: { dark: '#0f0a1e', light: '#ffffff' }
        });
        return {
          qrDataUrl,
          orderNumber: r.order_number ?? '——',
          seatLabel: r.seat_label
        };
      }));
    }

    const { subject, html } = eventTicketConfirmedEmail({
      ...brandToLayout(brand),
      buyerName: opts.buyerName ?? undefined,
      eventTitle: course.title,
      eventDate: dateStr,
      ticketsCount: opts.ticketsCount,
      amountFormatted: formatAmount(opts.amountCents, opts.currency),
      seats: opts.seats,
      accessUrl: `${origin}/account`,
      tickets: qrTickets
    });
    await sendEmail({ to: opts.buyerEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyEventTicketsConfirmed falló:', e);
  }
}

/** Después de crear/confirmar una reserva (mentorship_slot o start_date) */
export async function notifyBookingConfirmed(opts: {
  tenantId: string;
  courseId: string;
  buyerEmail: string;
  buyerName?: string | null;
  bookingDate: string;                 // ISO datetime
  instructorName?: string | null;
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const svc = getServiceClient();
    const { data: course } = await svc
      .from('courses')
      .select('title, slug')
      .eq('id', opts.courseId)
      .maybeSingle<{ title: string; slug: string }>();
    if (!course) return;

    const origin = tenantOrigin(brand.slug);
    const dateStr = new Date(opts.bookingDate).toLocaleString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const { subject, html } = bookingConfirmedEmail({
      ...brandToLayout(brand),
      buyerName: opts.buyerName ?? undefined,
      courseTitle: course.title,
      bookingDate: dateStr,
      instructorName: opts.instructorName ?? undefined,
      accessUrl: `${origin}/account`
    });
    await sendEmail({ to: opts.buyerEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyBookingConfirmed falló:', e);
  }
}

/** Cuando el instructor reagenda una clase */
export async function notifyBookingRescheduled(opts: {
  tenantId: string;
  courseId: string;
  buyerEmail: string;
  buyerName?: string | null;
  oldDate: string;
  newDate: string;
  reason?: string | null;
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const svc = getServiceClient();
    const { data: course } = await svc
      .from('courses')
      .select('title, slug')
      .eq('id', opts.courseId)
      .maybeSingle<{ title: string; slug: string }>();
    if (!course) return;

    const origin = tenantOrigin(brand.slug);
    const fmt = (iso: string) => new Date(iso).toLocaleString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const { subject, html } = bookingRescheduledEmail({
      ...brandToLayout(brand),
      buyerName: opts.buyerName ?? undefined,
      courseTitle: course.title,
      oldDate: fmt(opts.oldDate),
      newDate: fmt(opts.newDate),
      reason: opts.reason ?? undefined,
      accessUrl: `${origin}/account`
    });
    await sendEmail({ to: opts.buyerEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyBookingRescheduled falló:', e);
  }
}

/** Cuando el owner asigna a alguien como instructor */
export async function notifyInstructorAssigned(opts: {
  tenantId: string;
  instructorEmail: string;
  instructorName?: string | null;
}): Promise<void> {
  try {
    const brand = await loadTenantBrand(opts.tenantId);
    if (!brand) return;
    const origin = tenantOrigin(brand.slug);
    const { subject, html } = instructorWelcomeEmail({
      ...brandToLayout(brand),
      instructorName: opts.instructorName ?? undefined,
      portalUrl: `${origin}/instructor`
    });
    await sendEmail({ to: opts.instructorEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyInstructorAssigned falló:', e);
  }
}
