import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  price_cents: number;
  currency: string;
  created_at: string;
};

export default async function CoursesIndex() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("courses")
    .select("id, slug, title, status, price_cents, currency, created_at")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as CourseRow[];

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cursos</h1>
          <p className="text-white/60 text-sm mt-1">Crear, editar y publicar cursos.</p>
        </div>
        <Link
          href="/courses/new"
          className="rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
        >
          + Nuevo curso
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {courses.length === 0 ? (
          <div className="p-10 text-center text-white/50">
            Todavía no creaste ningún curso. <Link href="/courses/new" className="underline text-white">Creá el primero</Link>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Título</th>
                <th className="text-left px-4 py-2.5">Estado</th>
                <th className="text-left px-4 py-2.5">Precio</th>
                <th className="text-left px-4 py-2.5">Creado</th>
                <th className="text-right px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="px-4 py-3">
                    <Link href={`/courses/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    <div className="text-xs text-white/40">/{c.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded border ${
                      c.status === 'published'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : c.status === 'archived'
                          ? 'border-white/15 text-white/40'
                          : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/80">
                    {(c.price_cents / 100).toLocaleString('es-AR')} {c.currency}
                  </td>
                  <td className="px-4 py-3 text-white/50">
                    {new Date(c.created_at).toLocaleDateString('es-AR')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/courses/${c.id}`} className="text-xs text-white/60 hover:text-white">
                      Editar →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
