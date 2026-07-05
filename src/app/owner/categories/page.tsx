import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/owner/PageHeader";
import { CategoryTree } from "@/components/owner/products/CategoryTree";

export const dynamic = "force-dynamic";

export type Cat = {
  id: string;
  name: string;
  slug: string;
  position: number;
  parent_id: string | null;
  is_featured: boolean;
};

export default async function CategoriesPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  // Defensivo si migration 0054 no corrió → parent_id/is_featured no existen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try {
    const res = await svc
      .from("course_categories")
      .select("id, name, slug, position, parent_id, is_featured")
      .eq("tenant_id", tenant.id)
      .order("position", { ascending: true });
    if (res.error) throw res.error;
    data = res.data;
  } catch {
    const res = await svc
      .from("course_categories")
      .select("id, name, slug, position")
      .eq("tenant_id", tenant.id)
      .order("position", { ascending: true });
    data = (res.data ?? []).map((c: { id: string; name: string; slug: string; position: number }) => ({
      ...c, parent_id: null, is_featured: false
    }));
  }
  const cats = (data ?? []) as Cat[];

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Categorías"
        description="Agrupá tus publicaciones y productos. Podés anidar categorías (padre → hijo) para armar un mega-menú tipo MercadoLibre."
      />

      <CategoryTree categories={cats} />
    </div>
  );
}
