import { cookies } from "next/headers";
import type { Metadata } from "next";
import { getTenantById } from "@/lib/tenant/resolve";
import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mergeConfig } from "@/lib/site/types";
import { env } from "@/lib/env";
import { tenantMetadata } from "@/lib/seo/meta";
import { AffiliateBar } from "@/components/storefront/AffiliateBar";
import { StorefrontUserMenu } from "@/components/storefront/StorefrontUserMenu";
import { CartWidget } from "@/components/storefront/cart/CartWidget";
import { WhatsAppFloat } from "@/components/storefront/WhatsAppFloat";
import { CategoriesMegaMenu, type MegaCategory } from "@/components/storefront/CategoriesMegaMenu";
import { MastheadScrollBehavior } from "@/components/storefront/MastheadScrollBehavior";
import { MastheadCategoryNav } from "@/components/storefront/MastheadCategoryNav";

/**
 * Metadata default para TODO el storefront. Cada page individual puede
 * overridear con su propia `generateMetadata` con más precisión.
 * Los meta tags aparecen en preview de WhatsApp/Twitter/Facebook cuando
 * alguien comparte un link del sitio.
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{ tenantId: string }>;
}): Promise<Metadata> {
  const { tenantId } = await params;
  return tenantMetadata(tenantId);
}

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

  // ¿El user logueado es afiliado PLATFORM-LEVEL (de OfferNow)?
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
      } else {
        // Sin role de owner/instructor: es un buyer. El hub /mi-cuenta
        // consolida cursos, entradas, órdenes, reservas, saldo, planes.
        // Ya no forzamos hasEnrollments — mi-cuenta muestra empty state
        // amigable cuando no hay data y sigue siendo la landing correcta
        // para que el buyer pueda encontrar todo desde un solo lugar.
        panelHref = '/mi-cuenta';
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

  // Categorías para el mega-menú (si el owner lo prendió en cfg.nav)
  let megaCategories: MegaCategory[] = [];
  if (cfg.nav.show_categories_mega === true) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: catsRaw } = await (svc.from('course_categories') as any)
        .select('id, slug, name, parent_id, is_featured')
        .eq('tenant_id', tenantId).order('position', { ascending: true });
      megaCategories = (catsRaw ?? []) as MegaCategory[];
    } catch {
      // migration 0054 (parent_id/is_featured) pendiente — retry con schema
      // viejo (categorías planas).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: catsRaw } = await (svc.from('course_categories') as any)
          .select('id, slug, name').eq('tenant_id', tenantId).order('position', { ascending: true });
        megaCategories = ((catsRaw ?? []) as Array<{ id: string; slug: string; name: string }>)
          .map((c) => ({ ...c, parent_id: null, is_featured: true }));
      } catch { /* migration base pendiente */ }
    }
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
    <>
      {/* Override las vars a nivel :root porque la TopProgressBar y el
          spinner de nav global viven en el root layout (fuera de este
          div), y CSS vars solo cascadean hacia ABAJO. Sin este style
          tag el bar y el spinner quedaban naranjas fijos. */}
      <style dangerouslySetInnerHTML={{
        __html: `:root{--cp-brand-primary:${primary};--cp-brand-secondary:${accent};}`
      }} />
    <div
      className="min-h-screen bg-white text-black"
      style={{
        ['--brand-primary' as string]: primary,
        ['--brand-accent' as string]: accent,
        ['--cp-brand-primary' as string]: primary,
        ['--cp-brand-secondary' as string]: accent
      }}
    >
      {isAffiliate && !affBarHidden && (
        <AffiliateBar primary={primary} tenantSlug={tenant.slug} tenantId={tenantId} />
      )}
      {cfg.nav.style === 'masthead' ? (
        // ── Masthead editorial (NYT / WSJ / The Times) ─────────────────
        // Estructura scroll-adaptive:
        //   Estado inicial (scrolled=false):
        //     [Dark bar: hamburger+search+logo | date+CTA+login]
        //     [Blanco: LOGO GIGANTE centrado]
        //     [Blanco: categorías sticky top-14]
        //   Estado scrolled (después de bajar ~140px):
        //     [Dark bar: hamburger+search+logo | CATEGORÍAS inline | CTA+login]
        //     (el bloque blanco de arriba se scrolleó fuera, la fila blanca
        //     de categorías se oculta porque ahora viven en el dark bar)
        //   Todo controlado con data-scrolled="true" en el header +
        //   selectores CSS. El toggle lo hace MastheadScrollBehavior.
        <>
          <MastheadScrollBehavior />
          {/* Estilos de scroll-adaptive: cuando el header dark tiene
              data-scrolled="true", mostramos el nav inline dentro y
              ocultamos la fila blanca sticky de categorías (que sería
              redundante). El nav inline se anima con fade + slide. */}
          <style dangerouslySetInnerHTML={{ __html: `
            .cp-masthead-inline-nav { display: none !important; }
            .cp-masthead[data-scrolled="true"] .cp-masthead-inline-nav {
              display: flex !important;
              animation: cpMastheadNavIn 200ms ease-out;
            }
            .cp-masthead[data-scrolled="true"] ~ .cp-masthead-cats-row {
              opacity: 0;
              pointer-events: none;
              transition: opacity 150ms ease-out;
            }
            @keyframes cpMastheadNavIn {
              from { opacity: 0; transform: translateX(-8px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}} />
          <header data-storefront-header className="cp-masthead bg-[#0d1114] text-white sticky top-0 z-50 border-b border-white/10 h-14 flex items-center">
            <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-1">
                <button aria-label="Menú" className="w-9 h-9 rounded hover:bg-white/10 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
                </button>
                <a href="/blog" aria-label="Buscar" className="w-9 h-9 rounded hover:bg-white/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
                </a>
                {/* Logo compacto (más prominente ahora — text-2xl vs text-lg
                    antes — para acercarnos al look The Times). */}
                <a href="/" className="ml-3 inline-flex items-center gap-2 text-white hover:opacity-80">
                  {brand.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt={tenant.name} className="h-8 w-auto object-contain brightness-0 invert" />
                  ) : (
                    <span className="font-serif text-xl md:text-2xl font-bold tracking-tight">
                      {logoText || tenant.name}
                    </span>
                  )}
                </a>
                {/* Nav INLINE en el dark bar — hidden por default, aparece
                    cuando data-scrolled="true" (después de scrollear ~140px
                    y perder de vista el bloque grande blanco). */}
                {cfg.nav.links.length > 0 && (
                  <nav className="cp-masthead-inline-nav hidden ml-4 lg:ml-6 items-center gap-4 lg:gap-5 text-[12px] font-semibold text-white/90 whitespace-nowrap">
                    {cfg.nav.links.slice(0, 8).map((l) => (
                      <a key={l.id} href={l.href} className="hover:text-white transition uppercase tracking-wide">{l.label}</a>
                    ))}
                  </nav>
                )}
              </div>
              <div className="flex items-center gap-2 md:gap-3 text-[13px]">
                {/* Fecha antes vivía acá; ahora va centrada arriba del logo
                    grande (look The Times: "Friday July 17 2026"). Sacada
                    del dark bar para dar más espacio al CTA suscripción. */}
                {/* CTA de suscripción: usa el precio del plan MÁS BARATO del
                    site_config.sections.pricing.tiers. Se renderiza solo si
                    pricing está enabled y hay al menos 1 tier. Extraemos el
                    primer número del string price ("$ 1.990 / mes" → 1990). */}
                {(() => {
                  const pricing = cfg.sections?.pricing;
                  if (!pricing?.enabled) return null;
                  const tiers = Array.isArray(pricing.tiers) ? pricing.tiers : [];
                  if (tiers.length === 0) return null;
                  const cheapest = tiers
                    .map((t) => {
                      const match = (t.price || '').match(/[\d.,]+/);
                      const n = match ? parseFloat(match[0].replace(/\./g, '').replace(',', '.')) : NaN;
                      return { tier: t, price: n };
                    })
                    .filter((x) => Number.isFinite(x.price) && x.price > 0)
                    .sort((a, b) => a.price - b.price)[0];
                  if (!cheapest) return null;
                  return (
                    <a href={cheapest.tier.cta_href || '#pricing'}
                      className="rounded bg-white text-black text-[12px] md:text-[13px] font-bold px-3 py-1.5 hover:bg-white/90 whitespace-nowrap uppercase tracking-wide">
                      Suscribite por ${cheapest.price.toLocaleString('es-AR')}
                    </a>
                  );
                })()}
                {cfg.nav.show_login && (
                  <StorefrontUserMenu
                    loggedIn={!!user}
                    email={user?.email ?? ''}
                    primary={primary}
                    loginHref={`${appSubdomainUrl('/login')}?next=${encodeURIComponent(`https://${tenant.slug}.${env.rootDomain}/mi-cuenta`)}&tenant=${encodeURIComponent(tenantId)}`}
                    panelHref={panelHref}
                    hasEnrollments={hasEnrollments}
                    signoutRedirect="/"
                  />
                )}
              </div>
            </div>
          </header>
          {/* Bloque no-sticky: fecha + logo grande */}
          <div className="bg-white">
            <div className="max-w-6xl mx-auto px-6 pt-4 pb-6 md:pt-5 md:pb-7 text-center">
              {/* Fecha del día — centrada arriba del logo, tipografía chica
                  y gris. Matchea el look The Times ("Friday July 17 2026"). */}
              <div className="text-[11px] md:text-[12px] text-black/55 mb-2">
                {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <a href="/" className="inline-block">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={brand.logo_url} alt={tenant.name} className="h-16 md:h-24 w-auto mx-auto object-contain" />
                ) : (
                  <span className="font-serif text-5xl md:text-7xl font-black tracking-tight text-black">
                    {logoText || tenant.name}
                  </span>
                )}
              </a>
            </div>
          </div>
          {/* Nav de categorías: STICKY con top-14 (56px = altura del header
              dark). Al scrollear, la barra de categorías se ancla justo
              debajo del header dark y queda pegada arriba — look The Times. */}
          {(cfg.nav.links.length > 0 || cfg.nav.show_categories_mega) && (
            <div className="cp-masthead-cats-row bg-white border-b-[3px] border-black/20 sticky top-14 z-40">
              {cfg.nav.show_categories_mega === true && megaCategories.length > 0 && (
                <div className="max-w-6xl mx-auto px-6 pt-2">
                  <CategoriesMegaMenu
                    label={cfg.nav.categories_mega_label || 'Categorías'}
                    categories={megaCategories}
                    primary={primary}
                  />
                </div>
              )}
              <MastheadCategoryNav links={cfg.nav.links} />
            </div>
          )}
        </>
      ) : (
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
            <nav className="hidden md:flex items-center gap-6 text-sm text-black/70">
              {cfg.nav.show_categories_mega === true && megaCategories.length > 0 && (
                <CategoriesMegaMenu
                  label={cfg.nav.categories_mega_label || 'Categorías'}
                  categories={megaCategories}
                  primary={primary}
                />
              )}
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
                  loginHref={`${appSubdomainUrl('/login')}?next=${encodeURIComponent(`https://${tenant.slug}.${env.rootDomain}/mi-cuenta`)}&tenant=${encodeURIComponent(tenantId)}`}
                  panelHref={panelHref}
                  hasEnrollments={hasEnrollments}
                  signoutRedirect="/"
                />
              )}
            </div>
          </div>
        </header>
      )}

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

          <p className="text-xs text-black/30">Hecho con OfferNow</p>
        </div>
      </footer>
    </div>
    </>
  );
}
