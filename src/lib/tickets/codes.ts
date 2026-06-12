import 'server-only';
import crypto from 'crypto';

/**
 * Generadores de códigos para tickets de evento.
 *
 * - qr_token: 12 chars base32 (sin chars confusos 0/O/1/I). Unique a
 *   nivel DB — pero la probabilidad de colisión es ~0 (32^12 = 1e18).
 * - order_number: 6 chars legibles humanos (sin chars confusos), usado
 *   en el fallback manual cuando la pistola no funciona. NO es unique
 *   a nivel DB, solo a nivel evento (collision OK porque scope chico).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I/L

function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) {
    s += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return s;
}

export function generateQrToken(): string {
  return randomCode(12);
}

export function generateOrderNumber(): string {
  return randomCode(6);
}

/**
 * URL completa que va dentro del QR. Cuando el comprador escanea con
 * cualquier app de QR (incluso la cámara del iPhone), abre esta URL y
 * cae en la pantalla de validación. El owner ve el ticket directo.
 *
 * platformApiOrigin = https://app.<rootDomain> (donde corre la API).
 */
export function ticketQrUrl(qrToken: string, platformApiOrigin: string): string {
  return `${platformApiOrigin.replace(/\/$/, '')}/v/${qrToken}`;
}
