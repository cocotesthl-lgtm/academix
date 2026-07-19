import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * Cifrado simétrico AES-256-GCM para secretos guardados en DB
 * (access_token de WhatsApp, futuros credentials, etc).
 *
 * Formato del texto encriptado: "enc:v1:" + base64(iv|ciphertext|authTag)
 *   iv:         12 bytes
 *   authTag:    16 bytes
 *   ciphertext: resto
 *
 * La clave viene de ENV var SECRETS_ENCRYPTION_KEY (raw base64 de 32 bytes,
 * o cualquier string que hasheamos con SHA-256 para derivarla). Si no está
 * seteada, cae a un derivado del SUPABASE_SERVICE_ROLE_KEY con salt fijo —
 * esto permite arrancar sin config adicional; para producción real conviene
 * setear una key propia y rotarla con un flujo de re-encrypt.
 */

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const explicit = process.env.SECRETS_ENCRYPTION_KEY || '';
  if (explicit) {
    // Si vino en formato base64 de 32 bytes exactos, la usamos directo.
    try {
      const b = Buffer.from(explicit, 'base64');
      if (b.length === 32) return b;
    } catch { /* fallthrough */ }
    // Sino, derivamos con SHA-256 de la string.
    return createHash('sha256').update(explicit, 'utf8').digest();
  }
  // Fallback: derivar de la service key (para no romper si el owner
  // no seteó nada — pero mejor setear una clave dedicada).
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY || 'unsafe-fallback-key-set-SECRETS_ENCRYPTION_KEY';
  return createHash('sha256').update(fallback + ':whatsapp-secrets', 'utf8').digest();
}

/**
 * Encripta un string. Retorna el prefijo "enc:v1:" + base64 del blob.
 * Si el input ya está encriptado (prefijo detectado), lo devuelve tal cual —
 * evita doble-encriptar por error si un caller se olvida de chequear.
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, ct]).toString('base64');
  return PREFIX + blob;
}

/**
 * Desencripta. Si el input NO tiene el prefijo, lo devuelve tal cual —
 * esto mantiene compatibilidad con tokens legacy guardados en texto plano
 * antes de esta migración; la próxima escritura los rotará al formato nuevo.
 */
export function decryptSecret(encoded: string | null | undefined): string {
  if (!encoded) return '';
  if (!encoded.startsWith(PREFIX)) return encoded; // legacy plaintext
  const blob = Buffer.from(encoded.slice(PREFIX.length), 'base64');
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ct = blob.subarray(28);
  const key = getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/** True si el string ya está en formato encriptado (para chequeos condicionales). */
export function isEncrypted(s: string | null | undefined): boolean {
  return !!s && s.startsWith(PREFIX);
}
