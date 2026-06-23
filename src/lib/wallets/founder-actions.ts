'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { creditWallet } from './credit';

async function requireFounder(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('unauthorized');
  const { data: profile } = await supabase
    .from('profiles').select('is_super_admin').eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (!profile?.is_super_admin) throw new Error('forbidden');
  return user.id;
}

/** Ajuste de saldo desde el founder — puede tocar cualquier tenant. */
export async function founderAdjustWalletAction(formData: FormData): Promise<void> {
  const founderId = await requireFounder();
  const tenantId = String(formData.get('tenant_id') ?? '');
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!tenantId || !targetUserId) return;
  const amountPesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.-]/g, '') || '0');
  if (!Number.isFinite(amountPesos) || amountPesos === 0) return;
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || `Ajuste founder`;
  const cents = Math.round(amountPesos * 100);

  await creditWallet({
    tenantId,
    userId: targetUserId,
    amountCents: cents,
    kind: 'admin_adjust',
    note: `[founder] ${note}`,
    actorUserId: founderId
  });
  revalidatePath('/founder/wallets');
}
