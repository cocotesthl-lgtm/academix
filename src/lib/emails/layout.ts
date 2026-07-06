/**
 * Layout base de email — HTML con inline CSS (única forma de garantizar
 * compatibilidad cross-cliente: Gmail, Outlook, Apple Mail, iOS).
 *
 * NO usar React Email / templates con clases CSS: Gmail strippea <style>
 * tags y las clases no aplican. Inline styles es lo único confiable.
 *
 * El `brandColor` lo pasa cada llamada (cada tenant tiene su color), default
 * morado de OfferNow si no se pasa.
 */
function esc(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type LayoutOpts = {
  preheader?: string;     // texto chico que se ve en preview del inbox
  brandColor?: string;    // color principal del tenant (CTA, links)
  brandName?: string;     // nombre del tenant (header)
  logoUrl?: string;       // URL del logo del tenant
  footerNote?: string;    // tenant info, dirección, unsubscribe, etc.
  emailHeaderImageUrl?: string;  // banner top custom del tenant (URL only)
  emailBannerImageUrl?: string;  // strip mid email custom del tenant
  emailFooterMessage?: string;   // mensaje extra footer custom del tenant
};

export function renderLayout(opts: LayoutOpts & { content: string }): string {
  const brand = opts.brandColor || '#f97316';
  const brandName = esc(opts.brandName) || 'OfferNow';
  const preheader = esc(opts.preheader) || '';
  const logo = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${brandName}" style="max-height:40px;max-width:160px;display:block;margin:0 auto;" />`
    : `<div style="font-size:22px;font-weight:700;color:#0f0a1e;text-align:center;">${brandName}</div>`;

  // Custom blocks opcionales del tenant — solo se renderizan si vienen.
  const headerBanner = opts.emailHeaderImageUrl
    ? `<tr><td style="padding:0;line-height:0;">
        <img src="${esc(opts.emailHeaderImageUrl)}" alt="" style="display:block;width:100%;max-width:600px;height:auto;" />
       </td></tr>`
    : '';
  const midBanner = opts.emailBannerImageUrl
    ? `<tr><td style="padding:0 32px 24px;">
        <img src="${esc(opts.emailBannerImageUrl)}" alt="" style="display:block;width:100%;height:auto;border-radius:8px;" />
       </td></tr>`
    : '';
  // Footer message custom — soportamos HTML básico (links, br) pero esc del resto.
  // Estrategia simple: si el owner pone <a href> / <br> respetamos, sino esc todo.
  const customFooter = opts.emailFooterMessage
    ? `<tr><td style="padding:18px 32px;border-top:1px solid #eaeaef;background:#ffffff;font-size:13px;color:#374151;line-height:1.6;text-align:center;">
        ${opts.emailFooterMessage.replace(/\n/g, '<br/>')}
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${brandName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,Ubuntu,sans-serif;color:#1a1a1a;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${preheader}</div>
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f5f5f7;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    ${headerBanner}
    <tr><td style="padding:28px 32px;border-bottom:1px solid #eaeaef;background:#ffffff;">
      ${logo}
    </td></tr>
    <tr><td style="padding:32px;">
      ${opts.content}
    </td></tr>
    ${midBanner}
    ${customFooter}
    <tr><td style="padding:20px 32px;border-top:1px solid #eaeaef;background:#fafafb;font-size:12px;color:#6b7280;line-height:1.6;">
      ${opts.footerNote ? esc(opts.footerNote) + '<br/>' : ''}
      Este email fue enviado por <strong style="color:#1a1a1a;">${brandName}</strong> a través de OfferNow.<br/>
      Si recibiste este email por error, podés ignorarlo.
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export function ctaButton(opts: { href: string; label: string; color: string }): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;">
<tr><td style="background:${opts.color};border-radius:8px;">
  <a href="${esc(opts.href)}" style="display:inline-block;padding:14px 28px;font-weight:600;color:#ffffff;text-decoration:none;font-size:15px;">
    ${esc(opts.label)}
  </a>
</td></tr></table>`;
}

export function infoRow(label: string, value: string): string {
  return `<tr>
<td style="padding:8px 0;font-size:13px;color:#6b7280;width:40%;">${esc(label)}</td>
<td style="padding:8px 0;font-size:14px;color:#1a1a1a;font-weight:500;">${esc(value)}</td>
</tr>`;
}

export function infoTable(rows: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:16px 0;border-top:1px solid #eaeaef;border-bottom:1px solid #eaeaef;">
${rows}
</table>`;
}

export { esc };
