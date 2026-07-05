'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  createCategoryAction, renameCategoryAction, deleteCategoryAction,
  setCategoryParentAction, toggleCategoryFeaturedAction
} from '@/lib/categories/actions';
import type { Cat } from '@/app/owner/categories/page';

/**
 * Editor de categorías jerárquicas. Muestra los roots primero, con sus
 * children indentados debajo. Cada row:
 *   ⭐ [nombre] [selector padre] [Renombrar] [Eliminar]
 * El toggle ⭐ marca la categoría como featured (aparece en el mega-menú
 * del storefront). Un owner puede tener 30 categorías internas pero solo
 * destacar 8 en la nav.
 *
 * Para arrancar simple, evitamos drag-and-drop — el orden es por position
 * (que no editamos por ahora) y la jerarquía se cambia con el select.
 */
export function CategoryTree({ categories }: { categories: Cat[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newParent, setNewParent] = useState<string>('');

  // Root categories (parent_id=null) y children agrupados por parent_id
  const roots = useMemo(
    () => categories.filter((c) => !c.parent_id).sort((a, b) => a.position - b.position),
    [categories]
  );
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Cat[]>();
    for (const c of categories) {
      if (!c.parent_id) continue;
      if (!map.has(c.parent_id)) map.set(c.parent_id, []);
      map.get(c.parent_id)!.push(c);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [categories]);

  async function handleCreate(formData: FormData) {
    startTransition(async () => {
      await createCategoryAction(formData);
      setNewParent('');
      router.refresh();
    });
  }

  async function handleSetParent(id: string, newParentId: string | null) {
    startTransition(async () => {
      try {
        await setCategoryParentAction(id, newParentId);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'Error');
      }
      router.refresh();
    });
  }

  async function handleToggleFeatured(id: string, featured: boolean) {
    startTransition(async () => {
      await toggleCategoryFeaturedAction(id, featured);
      router.refresh();
    });
  }

  async function handleRename(formData: FormData) {
    startTransition(async () => {
      await renameCategoryAction(formData);
      router.refresh();
    });
  }

  async function handleDelete(formData: FormData) {
    const id = String(formData.get('id') ?? '');
    const cat = categories.find((c) => c.id === id);
    const hasKids = childrenByParent.get(id)?.length ?? 0;
    const msg = hasKids > 0
      ? `¿Eliminar "${cat?.name}"? Sus ${hasKids} subcategoría${hasKids === 1 ? '' : 's'} quedará${hasKids === 1 ? '' : 'n'} sin padre.`
      : `¿Eliminar "${cat?.name}"?`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      await deleteCategoryAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Crear */}
      <form action={handleCreate} className="rounded-lg border border-white/15 bg-white/[0.02] p-3 space-y-2">
        <div className="flex gap-2">
          <input
            name="name" required
            placeholder="Nueva categoría (ej. Remeras, Electrónica…)"
            className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          />
          <select
            name="parent_id"
            value={newParent}
            onChange={(e) => setNewParent(e.target.value)}
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm focus:outline-none focus:border-white/40"
          >
            <option value="">— Sin padre (root) —</option>
            {roots.map((r) => (
              <option key={r.id} value={r.id}>Subcategoría de: {r.name}</option>
            ))}
          </select>
          <button type="submit" disabled={pending}
            className="rounded bg-white text-black text-sm px-4 py-2 font-semibold hover:bg-white/90 disabled:opacity-50">
            + Crear
          </button>
        </div>
      </form>

      {/* Tree */}
      {roots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
          <div className="text-4xl mb-2">📂</div>
          <div className="text-white/70">Todavía no tenés categorías.</div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
          {roots.map((root) => {
            const kids = childrenByParent.get(root.id) ?? [];
            return (
              <div key={root.id}>
                <CategoryRow
                  cat={root}
                  isRoot
                  possibleParents={[]}
                  pending={pending}
                  onSetParent={handleSetParent}
                  onToggleFeatured={handleToggleFeatured}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
                {kids.map((kid) => (
                  <CategoryRow
                    key={kid.id}
                    cat={kid}
                    isRoot={false}
                    possibleParents={roots}
                    pending={pending}
                    onSetParent={handleSetParent}
                    onToggleFeatured={handleToggleFeatured}
                    onRename={handleRename}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            );
          })}
          {/* Huérfanas: categorías con parent_id que apunta a algo que no existe (edge case) */}
        </div>
      )}

      <p className="text-[11px] text-white/40">
        ⭐ = destacada en el mega-menú del storefront. El resto queda accesible desde /tienda pero sin
        aparecer en la nav principal.
      </p>
    </div>
  );
}

function CategoryRow({
  cat, isRoot, possibleParents, pending,
  onSetParent, onToggleFeatured, onRename, onDelete
}: {
  cat: Cat;
  isRoot: boolean;
  possibleParents: Cat[];
  pending: boolean;
  onSetParent: (id: string, parentId: string | null) => Promise<void>;
  onToggleFeatured: (id: string, featured: boolean) => Promise<void>;
  onRename: (fd: FormData) => Promise<void>;
  onDelete: (fd: FormData) => Promise<void>;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 ${isRoot ? '' : 'pl-10 bg-white/[0.02]'}`}>
      {/* Star toggle */}
      <button
        type="button"
        onClick={() => onToggleFeatured(cat.id, !cat.is_featured)}
        disabled={pending}
        className={`text-lg ${cat.is_featured ? 'text-amber-300' : 'text-white/25 hover:text-white/60'}`}
        title={cat.is_featured ? 'Quitar destacado' : 'Marcar como destacada en el mega-menú'}
      >
        ★
      </button>

      {/* Indent visual para children */}
      {!isRoot && <span className="text-white/30 text-lg">↳</span>}

      <form action={onRename} className="flex-1 flex items-center gap-2">
        <input type="hidden" name="id" value={cat.id} />
        <input
          name="name" defaultValue={cat.name}
          className={`flex-1 rounded bg-white/5 border border-white/15 px-3 py-1.5 text-sm focus:outline-none focus:border-white/40 ${isRoot ? 'font-semibold' : ''}`}
        />
        <span className="text-[10px] text-white/40 font-mono">/{cat.slug}</span>
        <button className="rounded border border-white/15 px-2.5 py-1 text-xs hover:bg-white/5">
          Guardar
        </button>
      </form>

      {/* Parent selector — solo para categorías que pueden tener padre (evita loops) */}
      <select
        value={cat.parent_id ?? ''}
        onChange={(e) => onSetParent(cat.id, e.target.value || null)}
        disabled={pending}
        className="rounded bg-white/5 border border-white/15 px-2 py-1 text-xs focus:outline-none focus:border-white/40 max-w-[180px]"
      >
        <option value="">— Root —</option>
        {possibleParents.map((p) => (
          <option key={p.id} value={p.id}>Sub de: {p.name}</option>
        ))}
      </select>

      <form action={onDelete}>
        <input type="hidden" name="id" value={cat.id} />
        <button
          type="submit"
          className="rounded border border-red-500/30 bg-red-500/10 text-red-300 px-2.5 py-1 text-xs hover:bg-red-500/20">
          ×
        </button>
      </form>
    </div>
  );
}
