'use server';

import { revalidatePath } from 'next/cache';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { MODULE_KEYS, MODULE_PRESETS, normalizeModules, type Modules, type PresetKey } from './types';

async function persist(tenantId: string, modules: Modules) {
  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (svc.from('tenants') as any).update({ modules }).eq('id', tenantId);
  revalidatePath('/', 'layout');
}

/** Toggle individual desde el form de /owner/modulos. */
export async function toggleModuleAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const key = String(formData.get('key') ?? '');
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!MODULE_KEYS.includes(key as (typeof MODULE_KEYS)[number])) return;

  const svc = getServiceClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (svc.from('tenants') as any)
    .select('modules').eq('id', tenant.id).maybeSingle();
  const current = normalizeModules((data as { modules?: unknown } | null)?.modules);
  await persist(tenant.id, { ...current, [key]: enabled });
}

/** Aplica un preset completo de una vez. */
export async function applyPresetAction(formData: FormData): Promise<void> {
  const { tenant } = await requireOwner();
  const preset = String(formData.get('preset') ?? '') as PresetKey;
  if (!(preset in MODULE_PRESETS)) return;
  await persist(tenant.id, { ...MODULE_PRESETS[preset].modules });
}
