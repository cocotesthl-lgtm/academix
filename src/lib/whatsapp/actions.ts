'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

/**
 * Normaliza un número tipo '+54 9 11 2345-6789' → '5491123456789' (formato
 * requerido por wa.me). Vacío o inválido → null (desactiva el botón).
 */
function normalizeWhatsApp(raw: string): string | null {
  const v = raw.replace(/[^\d]/g, '');
  if (!v) return null;
  if (v.length < 8 || v.length > 15) return null;
  return v;
}

export async function setWhatsAppConfigAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const rawNumber = String(formData.get('whatsapp_number') ?? '').trim();
  const greeting = String(formData.get('whatsapp_greeting') ?? '').trim().slice(0, 300) || null;
  const position = String(formData.get('whatsapp_position') ?? 'right');
  const cleanPos = position === 'left' ? 'left' : 'right';

  const number = rawNumber ? normalizeWhatsApp(rawNumber) : null;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({
    whatsapp_number: number,
    whatsapp_greeting: greeting,
    whatsapp_position: cleanPos
  }).eq('id', tenant.id);
  revalidatePath('/site');
  revalidatePath('/', 'layout');
}
