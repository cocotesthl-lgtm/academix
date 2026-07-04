import { cookies } from "next/headers";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mergeConfig } from "@/lib/site/types";
import { env } from "@/lib/env";
import { AffiliateBar } from "@/components/storefront/AffiliateBar";
import { StorefrontUserMenu } from "@/components/storefront/StorefrontUserMenu";
import { CartWidget } from "@/components/storefront/cart/CartWidget";
import { WhatsAppFloat } from "@/components/storefront/WhatsAppFloat";

/**
 * URL completa al subdomain 'app' (panel global donde vive el
 * WorkspaceSwitcher). Ej.: subdomainUrl('/dashboard') →
 * https://app.bzseguridad.store/dashboard
 */
function appSubdomainUrl(path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const host = isLocal
    ? `app.localhost${appUrl.port ? ":" + appUrl.port : ""}`
    : `app.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

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
          <p className="text-black/60 mt-2">Este sitio no está disponible en este momento.</p>
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
  // Storefront público lee site_config_published (snapshot del último
  // Publicar). Fallback a site_config (draft) para tenants que nunca
  // publicaron o si la migration 0048 está pendiente.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow } = await (svc.from('tenants') as any)
    .select('site_config, site_config_published')
    .eq('id', tenantId)
    .single();
  const row = tenantRow as { site_config?: unknown; site_config_published?: unknown } | null;
  const cfg = mergeConfig(row?.site_config_published ?? row?.site_config);

  // ¿El user logueado es afiliado PLATFORM-LEVEL (de Curplat)?
  // Si sí, mostramos la barra superior — puede afiliarse a este tenant
  // generando un link (la membership se autocrea ahí).
  // El user puede ocultar la barra con la ✕: setea cookie y la layout
  // respeta ese estado.
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  let isAffiliate = false;
  // Datos extra para el user menu (solo si está logueado): tiene enrollments
  // en este tenant? cuántos workspaces tiene?
  let hasEnrollments = false;
  // Default: si no logra resolver nada, mejor mandarlo al onboarding que a /workspaces (que ya no usamos como selector — el WorkspaceSwitcher del sidebar reemplaza eso).
  let panelHref = '/onboarding';
  if (user) {
    const { data: profile } = await svc
      .from('profiles').select('is_affiliate').eq('id', user.id)
      .maybeSingle<{ is_affiliate: boolean }>();
    isAffiliate = !!profile?.is_affiliate;

    // ¿Tiene enrollments activos en este tenant? Si sí, mostramos "Mis publicaciones"
    try {
      const { data: enr } = await svc
        .from('enrollments').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('tenant_id', tenantId).eq('status', 'active')
        .limit(1);
      hasEnrollments = !!enr;
    } catch { /* ignore */ }

    // Resolver el destino del botón "Panel" sin pasar por /workspaces (el
    // selector ahora vive dentro del sidebar como dropdown, no como página).
    // El panel global está en app.bzseguridad.store/dashboard (o /instructor)
    // y desde ahí el WorkspaceSwitcher cambia entre tenants.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: ms } = await (svc.from('memberships') as any)
        .select('role')
        .eq('user_id', user.id).eq('status', 'active')
        .in('role', ['owner', 'instructor']);
      const roles = ((ms ?? []) as Array<{ role: string }>).map((m) => m.role);
      if (roles.includes('owner')) {
        panelHref = appSubdomainUrl('/dashboard');
      } else if (roles.includes('instructor')) {
        panelHref = appSubdomainUrl('/instructor');
      } else if (hasEnrollments) {
        // Sin role de owner/instructor: si tiene cursos comprados acá → /learn
        panelHref = '/learn';
      }
    } catch { /* ignore */ }
  }
  // Cart mode + WhatsApp config (defensivo si migrations 0034/0044/0049 pendientes)
  let cartEnabled = false;
  let cartPosition: 'header' | 'floating' | 'both' = 'header';
  let cartDisplay: 'dropdown' | 'page' = 'dropdown';
  let whatsappNumber: string | null = null;
  let whatsappGreeting: string | null = null;
  let whatsappPosition: 'left' | 'right' = 'right';
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tcart } = await (svc.from('tenants') as any)
      .select('cart_enabled, cart_position, cart_display, whatsapp_number, whatsapp_greeting, whatsapp_position')
      .eq('id', tenantId).maybeSingle();
    const row = tcart as {
      cart_enabled?: boolean; cart_position?: string; cart_display?: string;
      whatsapp_number?: string | null; whatsapp_greeting?: string | null; whatsapp_position?: string;
    } | null;
    cartEnabled = row?.cart_enabled ?? false;
    if (row?.cart_position === 'floating' || row?.cart_position === 'both') cartPosition = row.cart_position;
    if (row?.cart_display === 'page') cartDisplay = 'page';
    whatsappNumber = row?.whatsapp_number ?? null;
    whatsappGreeting = row?.whatsapp_greeting ?? null;
    if (row?.whatsapp_position === 'left') whatsappPosition = 'left';
  } catch { /* migration pendiente */ }
  const showHeaderCart = cartEnabled && (cartPosition === 'header' || cartPosition === 'both');
  const showFloatingCart = cartEnabled && (cartPosition === 'floating' || cartPosition === 'both');

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
            {cfg.nav.show_my_courses === true && (
              <a href="/learn" className="hover:text-black">{cfg.nav.my_courses_label || 'Mis publicaciones'}</a>
            )}
            {cfg.nav.show_affiliates === true && (
              <a href="/affiliate" className="hover:text-black">{cfg.nav.affiliates_label || 'Afiliados'}</a>
            )}
          </nav>
          <div className="flex items-center gap-1.5">
            {showHeaderCart && (
              <CartWidget tenantId={tenantId} primary={primary} variant="header" display={cartDisplay} />
            )}
            {cfg.nav.show_login && (
              <StorefrontUserMenu
                loggedIn={!!user}
                email={user?.email ?? ''}
                primary={primary}
                loginHref={`${appSubdomainUrl('/login')}?next=${encodeURIComponent(`https://${tenant.slug}.${env.rootDomain}/learn`)}&tenant=${encodeURIComponent(tenantId)}`}
                panelHref={panelHref}
                hasEnrollments={hasEnrollments}
                signoutRedirect="/"
              />
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      {/* Botón flotante del carrito (si la posición elegida lo incluye) */}
      {showFloatingCart && (
        <CartWidget tenantId={tenantId} primary={primary} variant="floating" display={cartDisplay} />
      )}

      {/* Botón flotante de WhatsApp (si el owner cargó un número).
          Si el cart flotante está en la misma esquina, el WhatsApp se
          empuja a la otra para no superponer. */}
      <WhatsAppFloat
        number={whatsappNumber}
        greeting={whatsappGreeting}
        position={showFloatingCart && whatsappPosition === 'right' ? 'left' : whatsappPosition}
      />

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
