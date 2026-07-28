import { getServiceClient } from '@/lib/supabase/service';

export type ModerationStatus = 'active' | 'under_review' | 'suspended';

/**
 * Devuelve el `moderation_status` del user. Si la migration 0086 no corrió
 * (o el schema cache está stale) devuelve 'active' para no romper el flujo.
 * Un status desconocido cae también a 'active' para ser conservadores.
 */
export async function getUserModerationStatus(userId: string): Promise<ModerationStatus> {
  if (!userId) return 'active';
  const svc = getServiceClient();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (svc.from('profiles') as any)
      .select('moderation_status')
      .eq('id', userId)
      .maybeSingle();
    if (error) return 'active';
    const raw = (data as { moderation_status?: string } | null)?.moderation_status ?? 'active';
    if (raw === 'under_review' || raw === 'suspended') return raw;
    return 'active';
  } catch {
    return 'active';
  }
}
