import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { BrandingForm } from "@/components/owner/BrandingForm";
import { PageHeader, HeaderSecondary } from "@/components/owner/PageHeader";

export const dynamic = "force-dynamic";

type BrandRow = {
  logo_url?: string | null;
  logo_text?: string | null;
  logo_layout?: 'square' | 'horizontal' | null;
  primary_color?: string;
  accent_color?: string;
};

export default async function BrandingPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("tenants")
    .select("brand")
    .eq("id", tenant.id)
    .single<{ brand: Record<string, unknown> | null }>();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identidad"
        description="Logo y color principal de tu academia. Aparecen en tu storefront, emails de venta y entradas."
        actions={<HeaderSecondary href="/site">Editar páginas</HeaderSecondary>}
      />
      <BrandingForm
        initialName={tenant.name}
        initialBrand={(data?.brand as BrandRow) ?? {}}
        slug={tenant.slug}
        rootDomain={env.rootDomain}
      />
    </div>
  );
}
