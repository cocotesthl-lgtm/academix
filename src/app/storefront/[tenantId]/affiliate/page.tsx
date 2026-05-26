import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { getTenantById } from "@/lib/tenant/resolve";
import { AffiliateLinkButton } from "@/components/storefront/AffiliateLinkButton";

export const dynamic = "force-dynamic";

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  price_cents: number;
  currency: string;
  affiliate_enabled: boolean;
};

export default async function AffiliateDashboard({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);
  if (!tenant) redirect("/");
  const primary = tenant.brand?.primary_color ?? '#0a0a0a';

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/affiliate");

  const svc = getServiceClient();

  // Courses available for affiliation in this tenant
  const { data: courses } = await svc
    .from("courses")
    .select("id, slug, title, price_cents, currency, affiliate_enabled")
    .eq("tenant_id", tenantId)
    .eq("status", "published")
    .eq("affiliate_enabled", true)
    .order("created_at", { ascending: false });
  const courseRows = (courses ?? []) as CourseRow[];

  // Existing links for this user
  const { data: links } = await svc
    .from("affiliate_links")
    .select("course_id, code")
    .eq("affiliate_user_id", user.id)
    .eq("tenant_id", tenantId);
  const byCourse = new Map<string, string>(
    ((links ?? []) as Array<{ course_id: string; code: string }>).map((l) => [l.course_id, l.code])
  );

  function urlFor(courseSlug: string, code: string) {
    return `http://${tenant!.slug}.localhost:3000/c/${courseSlug}?ref=${code}`;
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Programa de afiliados</h1>
        <p className="text-black/60 mt-2">
          Generá un link único por curso y empezá a ganar comisión por cada venta que traés.
        </p>
      </div>

      {courseRows.length === 0 ? (
        <div className="rounded-xl border border-black/10 p-10 text-center text-black/50">
          Esta academia todavía no tiene cursos disponibles para afiliación.
        </div>
      ) : (
        <div className="space-y-4">
          {courseRows.map((c) => {
            const existingCode = byCourse.get(c.id);
            return (
              <div key={c.id} className="rounded-xl border border-black/10 p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-semibold">{c.title}</h3>
                    <p className="text-sm text-black/60">
                      Precio: {c.price_cents === 0 ? 'Gratis' : `${(c.price_cents/100).toLocaleString('es-AR')} ${c.currency}`}
                    </p>
                  </div>
                </div>
                <AffiliateLinkButton
                  courseId={c.id}
                  tenantSlug={tenant.slug}
                  initialCode={existingCode ?? null}
                  initialUrl={existingCode ? urlFor(c.slug, existingCode) : null}
                  primary={primary}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
