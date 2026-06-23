import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getTenantById } from "@/lib/tenant/resolve";

export const dynamic = "force-dynamic";

type EnrolledCourse = {
  id: string;
  course_id: string;
  status: string;
  created_at: string;
  courses: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
  } | null;
};

export default async function StudentLearn({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  const primary = tenant?.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/learn");

  const svc = getServiceClient();
  const { data } = await svc
    .from("enrollments")
    .select("id, course_id, status, created_at, courses ( id, title, slug, description )")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as EnrolledCourse[];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">Mis publicaciones</h1>
      <p className="text-black/60 mb-8">Hola {user.email}. Acá ves todo lo que comprás en esta sitio.</p>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-12 text-center">
          <p className="text-black/60 mb-4">Todavía no tenés publicaciones. Explorá el catálogo y empezá.</p>
          <Link
            href="/"
            className="inline-block rounded-md px-5 py-2.5 font-semibold text-white"
            style={{ background: primary }}
          >
            Ver catálogo
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {rows.map((e) =>
            e.courses ? (
              <Link
                key={e.id}
                href={`/learn/${e.courses.id}`}
                className="block rounded-xl border border-black/10 p-5 hover:shadow-lg transition"
              >
                <h3 className="font-semibold text-lg mb-1">{e.courses.title}</h3>
                {e.courses.description && (
                  <p className="text-sm text-black/60 line-clamp-2 mb-3">{e.courses.description}</p>
                )}
                <span
                  className="inline-block text-xs font-medium px-2 py-1 rounded text-white"
                  style={{ background: primary }}
                >
                  Continuar →
                </span>
              </Link>
            ) : null
          )}
        </div>
      )}
    </div>
  );
}
