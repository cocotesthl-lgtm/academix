'use client';

import { useTransition } from 'react';
import { deleteTenantAction } from '@/lib/founder/actions';

export function DeleteTenantButton({ tenantId, slug, name }: { tenantId: string; slug: string; name: string }) {
  const [pending, start] = useTransition();

  function onClick() {
    const typed = window.prompt(
      `⚠️ Esto borra "${name}" para siempre (cursos, ventas, afiliados, todo).\n\n` +
      `Para confirmar, escribí el slug exacto:  ${slug}`
    );
    if (typed === null) return;
    if (typed.trim() !== slug) {
      window.alert('El slug no coincide. Cancelado.');
      return;
    }
    start(async () => {
      const fd = new FormData();
      fd.set('tenant_id', tenantId);
      fd.set('confirm', slug);
      await deleteTenantAction(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-xs rounded border border-red-500/40 bg-red-500/15 text-red-200 px-2 py-1 hover:bg-red-500/30 disabled:opacity-50"
    >
      {pending ? 'Borrando…' : 'Eliminar'}
    </button>
  );
}
