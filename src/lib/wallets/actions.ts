'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { creditWallet } from './credit';

/**
 * Ajuste manual de saldo desde el panel del owner. Acredita o debita N pesos
 * con una nota explicativa.
 */
export async function adminAdjustWalletAction(formData: FormData): Promise<void> {
  const { tenant, userId: actor } = await requireOwner();
  const targetUserId = String(formData.get('user_id') ?? '');
  if (!targetUserId) return;
  const amountPesos = parseFloat(String(formData.get('amount') ?? '0').replace(/[^0-9.-]/g, '') || '0');
  if (!Number.isFinite(amountPesos) || amountPesos === 0) return;
  const note = String(formData.get('note') ?? '').trim().slice(0, 500) || null;
  const cents = Math.round(amountPesos * 100);

  await creditWallet({
    tenantId: tenant.id,
    userId: targetUserId,
    amountCents: cents,
    kind: 'admin_adjust',
    note,
    actorUserId: actor
  });
  revalidatePath('/owner/wallets');
}
