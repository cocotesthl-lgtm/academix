import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction
} from "@/lib/categories/actions";

export const dynamic = "force-dynamic";

type Cat = { id: string; name: string; slug: string; position: number };

export default async function CategoriesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("course_categories")
    .select("id, name, slug, position")
    .eq("tenant_id", tenant.id)
    .order("position", { ascending: true });
  const cats = (data ?? []) as Cat[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Categorías</h1>
        <p className="text-white/60 text-sm mt-1">Organizá tus cursos en categorías que tus alumnos puedan filtrar.</p>
      </div>

      <form action={createCategoryAction} className="flex gap-2">
        <input
          name="name"
          required
          placeholder="Nueva categoría (ej. UX, Trading, Cocina)"
          className="flex-1 rounded-md bg-white/5 border border-white/15 px-3 py-2 focus:outline-none focus:border-white/40"
        />
        <button className="rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90">
          Agregar
        </button>
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {cats.length === 0 ? (
          <div className="p-6 text-sm text-white/50">Sin categorías todavía.</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {cats.map((c) => (
              <li key={c.id} className="p-4 flex items-center gap-3">
                <form action={renameCategoryAction} className="flex-1 flex gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input
                    name="name"
                    defaultValue={c.name}
                    className="flex-1 rounded bg-white/5 border border-white/15 px-3 py-1.5 focus:outline-none focus:border-white/40"
                  />
                  <span className="text-xs text-white/40 self-center">/{c.slug}</span>
                  <button className="rounded border border-white/15 px-3 py-1.5 text-sm hover:bg-white/5">
                    Renombrar
                  </button>
                </form>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="rounded border border-red-500/30 bg-red-500/10 text-red-300 px-3 py-1.5 text-sm hover:bg-red-500/20">
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
