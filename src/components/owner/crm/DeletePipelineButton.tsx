'use client';

import { deletePipelineAction } from '@/lib/crm/actions';

/**
 * Botón "Eliminar pipeline" con confirm() nativo. Vive en un componente
 * client aparte porque el CRM page es Server Component y no puede
 * llevar onClick handlers.
 */
export function DeletePipelineButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deletePipelineAction} className="ml-auto">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-xs text-rose-300 hover:text-rose-200 px-2 py-1 rounded border border-rose-500/30 hover:bg-rose-500/10"
        onClick={(e) => {
          if (!confirm(`¿Eliminar el pipeline "${name}" y todos sus leads?`)) {
            e.preventDefault();
          }
        }}
      >
        Eliminar pipeline
      </button>
    </form>
  );
}
