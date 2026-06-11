import { renderLayout, ctaButton, infoTable, infoRow, esc, type LayoutOpts } from './layout';

/**
 * Templates de email — funciones puras que devuelven HTML.
 * Cada template recibe los datos que necesita + opciones de branding del
 * tenant. No tocan DB ni I/O — eso lo resuelve el caller antes de invocar.
 */

type Brand = Pick<LayoutOpts, 'brandColor' | 'brandName' | 'logoUrl' | 'footerNote'>;

/** Compra de curso confirmada */
export function purchaseConfirmedEmail(opts: Brand & {
  buyerName?: string;
  courseTitle: string;
  amountFormatted: string;       // ej "ARS 15.000"
  accessUrl: string;             // link al portal del alumno
  buyerEmail?: string;
}): { subject: string; html: string } {
  const greeting = opts.buyerName ? `¡Hola ${opts.buyerName}!` : '¡Hola!';
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f0a1e;">${greeting}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Confirmamos tu compra de <strong>${esc(opts.courseTitle)}</strong>. Ya tenés acceso completo desde tu cuenta.
    </p>
    ${infoTable(
      infoRow('Curso', opts.courseTitle) +
      infoRow('Monto', opts.amountFormatted) +
      (opts.buyerEmail ? infoRow('Email', opts.buyerEmail) : '')
    )}
    ${ctaButton({ href: opts.accessUrl, label: 'Acceder al curso', color: opts.brandColor || '#a855f7' })}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Si tenés dudas con el acceso, respondé a este email y te ayudamos.
    </p>
  `;
  return {
    subject: `✓ Compra confirmada · ${opts.courseTitle}`,
    html: renderLayout({
      ...opts,
      preheader: `Ya tenés acceso a ${opts.courseTitle}`,
      content
    })
  };
}

/** Ticket de evento confirmado (con datos del asiento si aplica) */
export function eventTicketConfirmedEmail(opts: Brand & {
  buyerName?: string;
  eventTitle: string;
  eventDate: string;             // "vie 12 jul 2026, 20:30"
  ticketsCount: number;
  amountFormatted: string;
  seats?: string[];              // ["VIP A1", "VIP A2"] si hay asientos
  accessUrl: string;
}): { subject: string; html: string } {
  const greeting = opts.buyerName ? `¡Hola ${opts.buyerName}!` : '¡Hola!';
  const ticketsWord = opts.ticketsCount === 1 ? 'ticket' : 'tickets';
  const seatsRow = opts.seats && opts.seats.length > 0
    ? infoRow('Asientos', opts.seats.join(', '))
    : '';
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f0a1e;">${greeting} 🎫</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Tus ${opts.ticketsCount} ${ticketsWord} para <strong>${esc(opts.eventTitle)}</strong> están confirmados.
    </p>
    ${infoTable(
      infoRow('Evento', opts.eventTitle) +
      infoRow('Fecha', opts.eventDate) +
      infoRow('Cantidad', String(opts.ticketsCount)) +
      seatsRow +
      infoRow('Total pagado', opts.amountFormatted)
    )}
    ${ctaButton({ href: opts.accessUrl, label: 'Ver mis tickets', color: opts.brandColor || '#a855f7' })}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Guardá este email — el día del evento te lo pueden pedir para validar entrada.
    </p>
  `;
  return {
    subject: `🎫 Ticket confirmado · ${opts.eventTitle}`,
    html: renderLayout({
      ...opts,
      preheader: `${opts.ticketsCount} ${ticketsWord} para ${opts.eventTitle}`,
      content
    })
  };
}

/** Reserva de mentoría / clase confirmada */
export function bookingConfirmedEmail(opts: Brand & {
  buyerName?: string;
  courseTitle: string;
  bookingDate: string;           // "vie 12 jul 2026, 20:30"
  instructorName?: string;
  accessUrl: string;
}): { subject: string; html: string } {
  const greeting = opts.buyerName ? `¡Hola ${opts.buyerName}!` : '¡Hola!';
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f0a1e;">${greeting} 🗓️</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Tu reserva para <strong>${esc(opts.courseTitle)}</strong> quedó confirmada.
    </p>
    ${infoTable(
      infoRow('Curso', opts.courseTitle) +
      infoRow('Fecha y hora', opts.bookingDate) +
      (opts.instructorName ? infoRow('Instructor', opts.instructorName) : '')
    )}
    ${ctaButton({ href: opts.accessUrl, label: 'Ver mi reserva', color: opts.brandColor || '#a855f7' })}
  `;
  return {
    subject: `🗓️ Reserva confirmada · ${opts.courseTitle}`,
    html: renderLayout({
      ...opts,
      preheader: `${opts.bookingDate} — ${opts.courseTitle}`,
      content
    })
  };
}

/** Reserva reagendada por el instructor — notificar al alumno */
export function bookingRescheduledEmail(opts: Brand & {
  buyerName?: string;
  courseTitle: string;
  oldDate: string;
  newDate: string;
  reason?: string;
  accessUrl: string;
}): { subject: string; html: string } {
  const greeting = opts.buyerName ? `Hola ${opts.buyerName},` : 'Hola,';
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f0a1e;">${greeting}</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Tu reserva para <strong>${esc(opts.courseTitle)}</strong> fue reagendada.
    </p>
    ${infoTable(
      infoRow('Curso', opts.courseTitle) +
      infoRow('Fecha anterior', opts.oldDate) +
      infoRow('Nueva fecha', opts.newDate) +
      (opts.reason ? infoRow('Motivo', opts.reason) : '')
    )}
    ${ctaButton({ href: opts.accessUrl, label: 'Ver nueva reserva', color: opts.brandColor || '#a855f7' })}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Si la nueva fecha no te queda, respondé a este email para coordinar.
    </p>
  `;
  return {
    subject: `🔄 Reserva reagendada · ${opts.courseTitle}`,
    html: renderLayout({
      ...opts,
      preheader: `Nueva fecha: ${opts.newDate}`,
      content
    })
  };
}

/** Bienvenida al ser asignado como instructor */
export function instructorWelcomeEmail(opts: Brand & {
  instructorName?: string;
  portalUrl: string;
}): { subject: string; html: string } {
  const greeting = opts.instructorName ? `¡Hola ${opts.instructorName}!` : '¡Hola!';
  const content = `
    <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f0a1e;">${greeting} 👨‍🏫</h1>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
      Te asignaron como instructor en <strong>${esc(opts.brandName || 'la academia')}</strong>.
      Ya podés cargar tu disponibilidad, ver las reservas y gestionar tus alumnos desde el portal.
    </p>
    ${ctaButton({ href: opts.portalUrl, label: 'Ir al portal de instructor', color: opts.brandColor || '#a855f7' })}
    <p style="margin:24px 0 0;font-size:13px;color:#6b7280;line-height:1.6;">
      Para acceder usá el email donde recibiste esta invitación.
    </p>
  `;
  return {
    subject: `👨‍🏫 Sos instructor en ${opts.brandName || 'la academia'}`,
    html: renderLayout({
      ...opts,
      preheader: 'Acceso al portal de instructor habilitado',
      content
    })
  };
}
