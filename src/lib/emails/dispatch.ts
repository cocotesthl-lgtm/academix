import 'server-only';
import { getServiceClient } from '@/lib/supabase/service';
import { tenantOrigin } from '@/lib/env';
import { sendEmail } from './client';
import {
  purchaseConfirmedEmail,
  eventTicketConfirmedEmail,
  bookingConfirmedEmail,
  bookingRescheduledEmail,
  instructorWelcomeEmail
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
};

async function loadTenantBrand(tenantId: string): Promise<TenantBrand | null> {
  const svc = getServiceClient();
  const { data } = await svc
    .from('tenants')
    .select('name, slug, brand')
    .eq('id', tenantId)
    .maybeSingle<{ name: string; slug: string; brand: { logo_url?: string; primary_color?: string } | null }>();
  if (!data) return null;
  return {
    name: data.name,
    slug: data.slug,
    logoUrl: data.brand?.logo_url,
    primaryColor: data.brand?.primary_color || '#a855f7'
  };
}

function formatAmount(cents: number, currency: string): string {
  const value = (cents / 100).toLocaleString('es-AR', { minimumFractionDigits: 0 });
  return `${currency} ${value}`;
}

/** Después de confirmar una compra de curso */
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
      brandName: brand.name,
      brandColor: brand.primaryColor,
      logoUrl: brand.logoUrl,
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

    const { subject, html } = eventTicketConfirmedEmail({
      brandName: brand.name,
      brandColor: brand.primaryColor,
      logoUrl: brand.logoUrl,
      buyerName: opts.buyerName ?? undefined,
      eventTitle: course.title,
      eventDate: dateStr,
      ticketsCount: opts.ticketsCount,
      amountFormatted: formatAmount(opts.amountCents, opts.currency),
      seats: opts.seats,
      accessUrl: `${origin}/account`
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
      brandName: brand.name,
      brandColor: brand.primaryColor,
      logoUrl: brand.logoUrl,
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
      brandName: brand.name,
      brandColor: brand.primaryColor,
      logoUrl: brand.logoUrl,
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
      brandName: brand.name,
      brandColor: brand.primaryColor,
      logoUrl: brand.logoUrl,
      instructorName: opts.instructorName ?? undefined,
      portalUrl: `${origin}/instructor`
    });
    await sendEmail({ to: opts.instructorEmail, subject, html });
  } catch (e) {
    console.error('[emails] notifyInstructorAssigned falló:', e);
  }
}
