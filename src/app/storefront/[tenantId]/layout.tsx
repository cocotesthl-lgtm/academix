import { cookies } from "next/headers";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mergeConfig } from "@/lib/site/types";
import { AffiliateBar } from "@/components/storefront/AffiliateBar";

export const dynamic = "force-dynamic";

const SOCIAL_LABEL: Record<string, string> = {
  instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn',
  twitter: 'Twitter', tiktok: 'TikTok', facebook: 'Facebook', web: 'Sitio web'
};

export default async function StorefrontLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const tenant = await getTenantById(tenantId);

  if (!tenant) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black p-8">
        Sitio no encontrada.
      </main>
    );
  }
  if (tenant.status === "suspended" || tenant.status === "closed") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-white text-black p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Temporalmente cerrado</h1>
          <p className="text-black/60 mt-2">Esta sitio no está disponible en este momento.</p>
        </div>
      </main>
    );
  }

  const brand = tenant.brand ?? {};
  const primary = brand.primary_color ?? '#0a0a0a';
  const accent = brand.accent_color ?? primary;
  const logoLayout: 'square' | 'horizontal' =
    (brand as { logo_layout?: string }).logo_layout === 'horizontal' ? 'horizontal' : 'square';
  const logoText = (brand as { logo_text?: string | null }).logo_text ?? null;

  const svc = getServiceClient();
  const { data: tenantRow } = await svc
    .from('tenants')
    .select('site_config')
    .eq('id', tenantId)
    .single<{ site_config: unknown }>();
  const cfg = mergeConfig(tenantRow?.site_config);

  // ¿El user logueado es afiliado PLATFORM-LEVEL (de Curplat)?
  // Si sí, mostramos la barra superior — puede afiliarse a este tenant
  // generando un link (la membership se autocrea ahí).
  // El user puede ocultar la barra con la ✕: setea cookie y la layout
  // respeta ese estado.
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  let isAffiliate = false;
  if (user) {
    const { data: profile } = await svc
      .from('profiles').select('is_affiliate').eq('id', user.id)
      .maybeSingle<{ is_affiliate: boolean }>();
    isAffiliate = !!profile?.is_affiliate;
  }
  // Cookie de "barra de afiliado oculta" (defensivo: cookies() puede fallar
  // en algunos contextos de edge / preview, no queremos voltear la página
  // entera por eso).
  let affBarHidden = false;
  try {
    const cookieStore = await cookies();
    affBarHidden = !!cookieStore.get(`aff_bar_hidden_${tenantId}`)?.value;
  } catch { /* no-op */ }

  return (
    <div
      className="min-h-screen bg-white text-black"
      style={{
        ['--brand-primary' as string]: primary,
        ['--brand-accent' as string]: accent
      }}
    >
      {isAffiliate && !affBarHidden && (
        <AffiliateBar primary={primary} tenantSlug={tenant.slug} tenantId={tenantId} />
      )}
      <header data-storefront-header className="storefront-header border-b border-black/10 bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-3">
            {logoLayout === 'horizontal' && brand.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logo_url} alt={tenant.name} className="h-9 w-auto max-w-[200px] object-contain" />
            ) : (
              <>
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo_url} alt={tenant.name} className="h-9 w-9 object-contain rounded" />
                ) : (
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold"
                    style={{ background: primary }}
                  >
                    {tenant.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="font-bold leading-tight">
                  {logoText || tenant.name}
                </div>
              </>
            )}
          </a>
          <nav className="hidden md:flex gap-6 text-sm text-black/70">
            {cfg.nav.links.map((l) => (
              <a key={l.id} href={l.href} className="hover:text-black">{l.label}</a>
            ))}
            {cfg.nav.show_my_courses !== false && (
              <a href="/learn" className="hover:text-black">{cfg.nav.my_courses_label || 'Mis publicaciones'}</a>
            )}
            {cfg.nav.show_affiliates !== false && (
              <a href="/affiliate" className="hover:text-black">{cfg.nav.affiliates_label || 'Afiliados'}</a>
            )}
          </nav>
          {cfg.nav.show_login && (
            <a href="/login" className="rounded-md text-sm font-medium px-4 py-2 text-white whitespace-nowrap" style={{ background: primary }}>
              Iniciar sesión
            </a>
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer data-storefront-footer className="storefront-footer border-t border-black/10 mt-16 py-10">
        <div className="max-w-5xl mx-auto px-6 text-center space-y-4">
          <p className="text-sm text-black/70 whitespace-pre-line">
            {cfg.footer.text || `© ${new Date().getFullYear()} ${tenant.name}`}
          </p>

          {cfg.footer.socials.length > 0 && (
            <div className="flex justify-center gap-4 text-sm">
              {cfg.footer.socials.map((s) => (
                <a key={s.id} href={s.href} target="_blank" rel="noopener" className="text-black/60 hover:text-black">
                  {SOCIAL_LABEL[s.network] ?? s.network}
                </a>
              ))}
            </div>
          )}

          {cfg.footer.links.length > 0 && (
            <div className="flex justify-center gap-4 text-xs text-black/50">
              {cfg.footer.links.map((l) => (
                <a key={l.id} href={l.href} className="hover:text-black">{l.label}</a>
              ))}
            </div>
          )}

          <p className="text-xs text-black/30">Hecho con Curplat</p>
        </div>
      </footer>
    </div>
  );
}
