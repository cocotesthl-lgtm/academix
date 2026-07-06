import 'server-only';
import { sendEmail } from '@/lib/emails/client';

type ReservationEmail = {
  to: string;
  customerName: string;
  productTitle: string;
  venueName?: string | null;
  date: string;              // YYYY-MM-DD
  time?: string | null;
  partySize: number;
  tenantName: string;
};

function formatDate(d: string): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC'
  });
}

function shell(body: string, accent = '#7c3aed'): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a;">${body}<hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px;"><p style="font-size:11px;color:#888;">Enviado automáticamente. <span style="color:${accent};">OfferNow</span></p></div>`;
}

export async function sendReservationCreatedEmail(r: ReservationEmail): Promise<void> {
  const dateLine = `${formatDate(r.date)}${r.time ? ` · <strong>${r.time}</strong>` : ''}`;
  const html = shell(`
    <h2 style="margin:0 0 12px;">🟡 Recibimos tu reserva</h2>
    <p>Hola ${escapeHtml(r.customerName)},</p>
    <p>Te confirmamos que recibimos tu reserva en <strong>${escapeHtml(r.tenantName)}</strong>:</p>
    <table style="width:100%;background:#f7f7f7;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#666;">Producto:</td><td style="padding:4px 0;"><strong>${escapeHtml(r.productTitle)}</strong></td></tr>
      ${r.venueName ? `<tr><td style="padding:4px 0;color:#666;">Sede:</td><td style="padding:4px 0;">📍 ${escapeHtml(r.venueName)}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#666;">Fecha:</td><td style="padding:4px 0;">${dateLine}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Personas:</td><td style="padding:4px 0;">${r.partySize}</td></tr>
    </table>
    <p style="color:#666;font-size:14px;">Tu reserva está <strong>pendiente</strong>. Te avisamos por este mismo email cuando la confirmemos.</p>
  `);
  await sendEmail({ to: r.to, subject: `Recibimos tu reserva — ${r.tenantName}`, html });
}

export async function sendReservationStatusEmail(
  r: ReservationEmail & { status: 'confirmed' | 'cancelled' }
): Promise<void> {
  const isConfirmed = r.status === 'confirmed';
  const emoji = isConfirmed ? '✅' : '⚫';
  const title = isConfirmed ? '¡Reserva confirmada!' : 'Reserva cancelada';
  const body = isConfirmed
    ? `<p>¡Te esperamos!</p>`
    : `<p style="color:#666;">Si esto es un error, contactanos respondiendo este email.</p>`;
  const dateLine = `${formatDate(r.date)}${r.time ? ` · <strong>${r.time}</strong>` : ''}`;
  const html = shell(`
    <h2 style="margin:0 0 12px;">${emoji} ${title}</h2>
    <p>Hola ${escapeHtml(r.customerName)},</p>
    <p>Tu reserva en <strong>${escapeHtml(r.tenantName)}</strong> fue <strong>${isConfirmed ? 'confirmada' : 'cancelada'}</strong>.</p>
    <table style="width:100%;background:#f7f7f7;border-radius:8px;padding:16px;margin:16px 0;">
      <tr><td style="padding:4px 0;color:#666;">Producto:</td><td style="padding:4px 0;"><strong>${escapeHtml(r.productTitle)}</strong></td></tr>
      ${r.venueName ? `<tr><td style="padding:4px 0;color:#666;">Sede:</td><td style="padding:4px 0;">📍 ${escapeHtml(r.venueName)}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#666;">Fecha:</td><td style="padding:4px 0;">${dateLine}</td></tr>
      <tr><td style="padding:4px 0;color:#666;">Personas:</td><td style="padding:4px 0;">${r.partySize}</td></tr>
    </table>
    ${body}
  `);
  await sendEmail({ to: r.to, subject: `${emoji} ${title} — ${r.tenantName}`, html });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
