import 'server-only';
import { cookies } from 'next/headers';

/** Cookie que marca "el owner panel está editando template X". */
export const TEMPLATE_EDIT_COOKIE = 'cp_template_edit';

/**
 * Lee la cookie de template edit y devuelve el contexto (id/slug/name)
 * o null si no está. Se llama desde OwnerLayout (Server Component). Vive
 * en un archivo NO 'use server' para evitar que Next.js lo trate como
 * Server Action (los actions solo deben ser mutaciones).
 */
export async function getTemplateEditContext(): Promise<{ id: string; slug: string; name: string } | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(TEMPLATE_EDIT_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { id: string; slug: string; name: string };
    if (parsed?.id) return parsed;
    return null;
  } catch {
    return null;
  }
}
