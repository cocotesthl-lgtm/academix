import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { BrandingForm } from "@/components/owner/BrandingForm";

export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("brand")
    .eq("id", tenant.id)
    .single<{ brand: Record<string, string> | null }>();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding</h1>
        <p className="text-white/60 mt-1 text-sm">
          Personalizá cómo se ve tu academia para tus alumnos.
        </p>
      </div>
      <BrandingForm
        initialName={tenant.name}
        initialBrand={(data?.brand as { logo_url?: string; primary_color?: string; accent_color?: string }) ?? {}}
        slug={tenant.slug}
      />
    </div>
  );
}
