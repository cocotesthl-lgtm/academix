'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';

export type GiftCard = {
  id: string;
  tenant_id: string;
  code: string;
  amount_cents: number;
  currency: string;
  recipient_name: string | null;
  sender_name: string | null;
  message: string | null;
  expires_at: string | null;
  status: 'active' | 'redeemed' | 'expired' | 'cancelled';
  redeemed_at: string | null;
  redeemed_by_email: string | null;
  redeemed_order_id: string | null;
  created_at: string;
  updated_at: string;
};

// Alfabeto sin O/0/I/1 para evitar confusión al tipear a mano.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 8): string {
  let out = '';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[arr[i] % CODE_ALPHABET.length];
  return out;
}

async function uniqueCode(): Promise<string> {
  const svc = getServiceClient();
  for (let attempt = 0; attempt < 8; attempt++) {
    const c = randomCode(8);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (svc.from('gift_cards') as any)
      .select('id').eq('code', c).maybeSingle();
    if (!data) return c;
  }
  // Fallback: 10 chars
  return randomCode(10);
}

/** Crea una única gift card. */
export async function createGiftCardAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const amount = Math.max(1, Math.round(Number(formData.get('amount_cents') ?? 0)));
  if (amount === 0) throw new Error('Ingresá un monto válido.');
  const recipient = String(formData.get('recipient_name') ?? '').trim().slice(0, 80) || null;
  const sender = String(formData.get('sender_name') ?? '').trim().slice(0, 80) || null;
  const message = String(formData.get('message') ?? '').trim().slice(0, 500) || null;
  const expiresDays = Math.max(0, Math.round(Number(formData.get('expires_days') ?? 0)));
  const expiresAt = expiresDays > 0
    ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const code = await uniqueCode();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (svc.from('gift_cards') as any).insert({
    tenant_id: tenant.id,
    code,
    amount_cents: amount,
    recipient_name: recipient,
    sender_name: sender,
    message,
    expires_at: expiresAt
  }).select('id').single();
  if (error || !data) throw new Error(error?.message || 'no se pudo crear');
  revalidatePath('/giftcards');
  redirect(`/giftcards/${data.id}`);
}

/** Crea N gift cards del mismo monto (para stock físico). */
export async function bulkCreateGiftCardsAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const amount = Math.max(1, Math.round(Number(formData.get('amount_cents') ?? 0)));
  const count = Math.max(1, Math.min(200, Math.round(Number(formData.get('count') ?? 1))));
  const expiresDays = Math.max(0, Math.round(Number(formData.get('expires_days') ?? 0)));
  const expiresAt = expiresDays > 0
    ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      tenant_id: tenant.id,
      code: await uniqueCode(),
      amount_cents: amount,
      expires_at: expiresAt
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('gift_cards') as any).insert(rows);
  revalidatePath('/giftcards');
  redirect(`/giftcards?bulk=${count}`);
}

export async function cancelGiftCardAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('gift_cards') as any).update({
    status: 'cancelled', updated_at: new Date().toISOString()
  }).eq('id', id).eq('tenant_id', tenant.id).eq('status', 'active');
  revalidatePath('/giftcards');
  revalidatePath(`/giftcards/${id}`);
}

export async function deleteGiftCardAction(id: string): Promise<void> {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  await svc.from('gift_cards').delete().eq('id', id).eq('tenant_id', tenant.id);
  revalidatePath('/giftcards');
  redirect('/giftcards');
}
