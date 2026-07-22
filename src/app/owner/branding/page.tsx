import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { BrandingForm } from "@/components/owner/BrandingForm";
import { EmailBrandingForm } from "@/components/owner/EmailBrandingForm";
import { PageHeader, HeaderSecondary } from "@/components/owner/PageHeader";
import { DomainSection } from "@/components/owner/domain/DomainSection";

export const dynamic = "force-dynamic";

type BrandRow = {
  logo_url?: string | null;
  logo_text?: string | null;
  logo_layout?: 'square' | 'horizontal' | null;
  primary_color?: string;
  accent_color?: string;
};

export default async function BrandingPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; msg?: string; ok?: string }>;
}) {
  const { tenant } = await requireOwner();
  const sp = await searchParams;
  const svc = getServiceClient();

  // Defensivo: si migration 0021 no corrió, las columnas email_* no existen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any = null;
  try {
    const res = await svc
      .from("tenants")
      .select("brand, email_header_image_url, email_banner_image_url, email_footer_message")
      .eq("id", tenant.id).single();
    if (!res.error) data = res.data;
  } catch { /* migration missing */ }
  if (!data) {
    const res = await svc.from("tenants").select("brand").eq("id", tenant.id).single();
    data = res.data;
  }
  const brand = (data?.brand as BrandRow) ?? {};

  return (
    <div className="space-y-10 max-w-5xl">
      <PageHeader
        title="Identidad y dominio"
        description="Logo, colores, branding de emails y tu URL — todo lo que hace a tu marca en un solo lugar."
        actions={<HeaderSecondary href="/site">Editar páginas</HeaderSecondary>}
      />

      <section id="marca">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-4">Marca visual</h2>
        <BrandingForm
          initialName={tenant.name}
          initialBrand={brand}
          slug={tenant.slug}
          rootDomain={env.rootDomain}
        />
      </section>

      <section id="emails" className="pt-8 border-t border-white/10 scroll-mt-24">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-2">Personalización de emails</h2>
        <p className="text-xs text-white/55 mb-4">
          Banners e info extra que se inyectan en los emails de confirmación de compra y tickets.
          Todo opcional — sin estos campos, el email sale con el branding básico.
        </p>
        <EmailBrandingForm
          initialHeader={data?.email_header_image_url ?? ''}
          initialBanner={data?.email_banner_image_url ?? ''}
          initialFooter={data?.email_footer_message ?? ''}
          brandColor={brand.primary_color ?? '#f97316'}
          brandName={tenant.name}
          logoUrl={brand.logo_url ?? undefined}
        />
      </section>

      <div className="pt-8 border-t border-white/10">
        <DomainSection
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          searchError={sp.error}
          searchMsg={sp.msg}
          searchOk={sp.ok}
        />
      </div>
    </div>
  );
}
