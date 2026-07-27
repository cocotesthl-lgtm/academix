import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleOneTapButton } from "@/components/auth/GoogleOneTapButton";
import { DomainChecker } from "@/components/marketing/DomainChecker";
import { LastSalePopup } from "@/components/marketing/LastSalePopup";
import { MarketingAuthNav } from "@/components/marketing/MarketingAuthNav";

export const dynamic = "force-dynamic";

/**
 * Landing marketing rediseñada al estilo WordPress.com/es:
 *   · Hero centrado con mockup grande debajo
 *   · Feature blocks editoriales alternados (split + card grid)
 *   · Grilla de plantillas por vertical (ecommerce, curso, restaurante, spa…)
 *   · Sección "también para grandes negocios" con logos
 *   · Pricing tabular con 3 tiers
 *   · CTA final grande
 *   · Footer denso multi-columna con language selector + social + legal
 */
export default async function MarketingHome() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const showOneTap = !user;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      {showOneTap && <GoogleOneTapButton showButton={false} next="/" />}

      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-neutral-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-sm text-neutral-700">
            <a href="#features" className="hover:text-neutral-900 transition">Features</a>
            <a href="#plantillas" className="hover:text-neutral-900 transition">Plantillas</a>
            <a href="#negocios" className="hover:text-neutral-900 transition">Casos de uso</a>
            <a href="#precio" className="hover:text-neutral-900 transition">Precio</a>
          </div>
          <div className="flex items-center gap-3">
            <MarketingAuthNav variant="light" loginLabel="Acceder" signupLabel="Empezar gratis" />
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Hero — 2 columnas sobre fondo blanco con acentos naranja/negro */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-white text-neutral-900">
        {/* Blob decorativo naranja detrás del contenido */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full bg-orange-100/60 blur-3xl pointer-events-none" aria-hidden />
        <div className="absolute -bottom-24 left-1/4 w-[400px] h-[400px] rounded-full bg-amber-100/40 blur-3xl pointer-events-none" aria-hidden />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28 grid lg:grid-cols-2 gap-12 items-center">
          {/* Columna izquierda: texto */}
          <div>
            {/* Badge rating estilo G² */}
            <div className="inline-flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-lg">
                ★
              </div>
              <div className="text-sm">
                <span className="font-bold text-neutral-900">Beta abierta</span>
                <span className="text-neutral-600"> · Argentina · LatAm</span>
              </div>
            </div>

            <h1 className="font-serif font-normal tracking-tight leading-[1.0] text-5xl md:text-6xl lg:text-7xl text-neutral-900">
              OfferNow,<br />
              <span className="italic text-orange-500">como debe ser</span>
            </h1>

            <p className="mt-8 text-lg md:text-xl text-neutral-700 max-w-lg leading-relaxed">
              La plataforma para vender cualquier cosa online — cursos, productos físicos,
              entradas, gift cards, reservas — con tu dominio, tu marca, y cobrando directo a MercadoPago.
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-block rounded-md bg-neutral-900 text-white px-8 py-4 text-base font-bold hover:bg-neutral-800 transition shadow-lg"
              >
                Empezá ahora
              </Link>
              <Link
                href="/demo"
                className="inline-block rounded-md border-2 border-neutral-900 bg-white text-neutral-900 px-8 py-4 text-base font-bold hover:bg-neutral-100 transition"
              >
                Ver demo
              </Link>
            </div>
          </div>

          {/* Columna derecha: imagen stock + floating cards */}
          <div className="relative h-[420px] lg:h-[520px]">
            {/*
              Imagen de stock (Unsplash CDN, license libre para uso).
              Reemplazable con cualquier URL — cuando tengas screenshot
              real del panel, cambiá src y alt:
                <img src="TU_URL.png" alt="..." ... />
              Recomendado: screenshot 4:3, fondo blanco.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=900&h=680&fit=crop&auto=format&q=80"
              alt="Persona atendiendo su tienda online"
              className="absolute inset-y-0 right-0 h-full w-auto rounded-2xl shadow-2xl object-cover"
              style={{ maxWidth: '100%' }}
            />

            {/* Card flotante superior-derecha: "Última venta" — rota con múltiples ejemplos */}
            <LastSalePopup />

            {/* Card flotante inferior-izquierda: "Tiempo de actividad" */}
            <div className="hidden md:block absolute bottom-4 left-4 lg:-left-4 lg:bottom-0 w-64 rounded-xl bg-white shadow-xl p-4 z-10 border border-neutral-100">
              <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 font-semibold">
                Tiempo de actividad
              </div>
              <div className="text-orange-500 text-2xl font-bold">99,999 %</div>
              <svg viewBox="0 0 200 40" className="w-full h-8 mt-1">
                <path d="M0,32 Q30,25 60,22 T120,15 T200,8"
                  stroke="rgb(249 115 22)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                <circle cx="200" cy="8" r="4" fill="rgb(249 115 22)" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Sistema completo — 4 cards con ícono circular estilo WordPress */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className="relative border-t border-neutral-200 py-24 bg-[#f5f5f5]">
        {/* Patrón de líneas sutil (como en el WP hero) */}
        <div className="absolute inset-0 opacity-[0.06] pointer-events-none" aria-hidden
          style={{
            backgroundImage: 'linear-gradient(30deg, transparent 45%, #262626 45%, #262626 46%, transparent 46%), linear-gradient(150deg, transparent 45%, #262626 45%, #262626 46%, transparent 46%)',
            backgroundSize: '80px 80px'
          }} />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Sistema completo</p>
            <h2 className="text-4xl md:text-5xl font-serif italic">
              Todo integrado, sin plugins
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              Otras plataformas te venden el sitio y te cobran aparte por cada módulo. Acá está todo.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: "Todo tipo de producto",
                body: "Cursos, productos físicos con variantes y stock, entradas con QR, gift cards, reservas y mentorías. Un panel para vender lo que quieras.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                )
              },
              {
                title: "Cobrás vos, directo",
                body: "Conectás tu MercadoPago con OAuth. La plata de cada venta entra a tu cuenta. Nosotros cobramos comisión solo sobre ventas confirmadas.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2"/>
                    <line x1="2" y1="10" x2="22" y2="10"/>
                  </svg>
                )
              },
              {
                title: "Sin costos de storage",
                body: "Conectás Google Drive y cargás lo que quieras. No cobramos por GB ni por video. Usás tu propio espacio, sin límites artificiales.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                )
              },
              {
                title: "Marketing incluido",
                body: "Afiliados multinivel, cupones, gift cards con QR, CRM con pipeline, formularios, blog con SEO, analytics de funnel — todo integrado.",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18"/>
                    <polyline points="7 14 12 9 15 12 21 6"/>
                  </svg>
                )
              }
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-6 hover:shadow-md transition"
              >
                <div className="w-12 h-12 rounded-full bg-orange-500 text-white flex items-center justify-center mb-6">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-3 text-neutral-900">{f.title}</h3>
                <p className="text-neutral-600 leading-relaxed text-sm">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Dominio propio */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-200 py-24 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm uppercase tracking-widest text-orange-600 mb-3 font-semibold">Tu dominio</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Hazte con tu <br className="hidden md:inline" />
            <span className="italic font-serif text-orange-600">pedacito de internet.</span>
          </h2>
          <p className="text-lg text-neutral-700 mb-10">
            Elegí un subdominio gratis o conectá tu propio dominio con un CNAME.
          </p>
          <DomainChecker />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Plantillas — grilla estilo WP themes */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="plantillas" className="border-t border-neutral-200 py-24 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Plantillas</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Arrastrá, editá, publicá.
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              Elegí un template de tu vertical y personalizalo con el editor visual. Sin código.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: "Indumentaria", desc: "Tienda de ropa con stock y talles", gradient: "from-pink-400 to-rose-500", icon: "👗" },
              { name: "Curso Online", desc: "Academia con videos por Drive", gradient: "from-blue-500 to-indigo-600", icon: "🎓" },
              { name: "Restaurante", desc: "Menú digital + reservas + gift cards", gradient: "from-amber-500 to-red-600", icon: "🍽️" },
              { name: "Spa & Wellness", desc: "Turnos, packs y gift cards con QR", gradient: "from-emerald-400 to-teal-600", icon: "🧖" },
              { name: "Eventos", desc: "Tickets con QR + asientos numerados", gradient: "from-purple-500 to-fuchsia-600", icon: "🎟️" },
              { name: "Coach Personal", desc: "Mentorías 1-a-1 con calendario", gradient: "from-orange-400 to-red-500", icon: "💪" },
              { name: "Librería / Books", desc: "Catálogo con categorías y envío", gradient: "from-yellow-500 to-orange-600", icon: "📚" },
              { name: "Blog Editorial", desc: "CMS de notas con SEO y RSS", gradient: "from-neutral-700 to-neutral-900", icon: "📰" },
              { name: "Membresía VIP", desc: "Contenido bloqueado + DMs con fans", gradient: "from-fuchsia-500 to-pink-600", icon: "💎" }
            ].map((t) => (
              <div key={t.name} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden hover:border-neutral-900 hover:shadow-lg transition group cursor-pointer">
                <div className={`aspect-[16/10] bg-gradient-to-br ${t.gradient} p-6 relative overflow-hidden`}>
                  <div className="text-5xl">{t.icon}</div>
                  {/* Fake browser chrome overlay */}
                  <div className="absolute inset-x-3 bottom-3 rounded-lg bg-white/90 backdrop-blur p-2 flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="flex-1 h-3 rounded-sm bg-neutral-100" />
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg">{t.name}</h3>
                  <p className="text-sm text-neutral-600 mt-1">{t.desc}</p>
                  <div className="mt-4 flex items-center gap-3 text-sm">
                    <span className="font-semibold text-orange-500 group-hover:underline">Empezar con este template →</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link href="/signup" className="text-neutral-900 font-semibold hover:underline">
              Ver todos los templates →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Tu hogar en internet — 3 features cards con imagen */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-200 py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Todo en un lugar</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Tu hogar en internet.
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "Ecommerce físico",
                body: "Productos con variantes de talle y color, stock automático, zonas de envío por provincia con tarifas por peso, órdenes con tracking, scanner de códigos de barra y etiquetas imprimibles.",
                cta: "Ver detalles",
                gradient: "from-orange-100 to-amber-100",
                icon: "📦"
              },
              {
                title: "Cursos y membresías",
                body: "Videos por Google Drive sin costo de storage, módulos y lecciones con progreso por alumno, mentorías 1-a-1 con calendario, contenido VIP bloqueado, DMs con fans.",
                cta: "Empezá gratis",
                gradient: "from-blue-100 to-indigo-100",
                icon: "🎓"
              },
              {
                title: "Marketing built-in",
                body: "Afiliados multinivel con tracking, cupones y gift cards con QR, blog con SEO y sitemap, formularios conectados a CRM con pipeline Kanban, analytics de funnel de conversión.",
                cta: "Descubrí más",
                gradient: "from-emerald-100 to-teal-100",
                icon: "🚀"
              }
            ].map((c) => (
              <div key={c.title} className="rounded-3xl border border-neutral-200 bg-white overflow-hidden hover:shadow-xl transition">
                <div className={`aspect-video bg-gradient-to-br ${c.gradient} flex items-center justify-center`}>
                  <span className="text-6xl">{c.icon}</span>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2">{c.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">{c.body}</p>
                  <div className="mt-5">
                    <Link href="/signup" className="text-orange-500 font-semibold hover:underline text-sm">
                      {c.cta} →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Casos de uso / verticales */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="negocios" className="border-t border-neutral-200 py-24 bg-[#fafafa]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Casos de uso</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Pensado para negocios de LatAm.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { t: "Tiendas físicas", b: "Ropa, deco, kioscos" },
              { t: "Cursos y academias", b: "Instructores y coaches" },
              { t: "Restaurantes", b: "Menú + reservas + gift cards" },
              { t: "Spas y salones", b: "Turnos + packs" },
              { t: "Eventos y venues", b: "Tickets con QR" },
              { t: "Servicios profesionales", b: "Coaches y freelancers" },
              { t: "Creators y VIP content", b: "Membresías + DMs" },
              { t: "Blogs editoriales", b: "CMS con SEO y RSS" }
            ].map((v) => (
              <div key={v.t} className="rounded-xl border border-neutral-200 bg-white p-4">
                <h3 className="font-semibold text-neutral-900 text-sm">{v.t}</h3>
                <p className="text-xs text-neutral-500 mt-1">{v.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Enterprise / grandes negocios */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-200 py-24 bg-neutral-900 text-white">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[2fr_3fr] gap-12 items-center">
          <div>
            <p className="text-sm uppercase tracking-widest text-orange-400 mb-3 font-semibold">Enterprise</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
              También para <br />
              <span className="italic font-serif">negocios grandes.</span>
            </h2>
            <p className="mt-4 text-neutral-400">
              Comisión reducida a partir de cierto volumen, multi-tenant para redes de marcas, soporte dedicado.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-full bg-white text-neutral-900 px-6 py-3 font-semibold hover:bg-neutral-100 transition"
            >
              Solicitar demo enterprise
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              "Comisión escalonada por volumen",
              "Multi-tenant para franquicias",
              "Slack directo con el equipo",
              "SLA de uptime 99.9%",
              "White-label completo",
              "Integración custom por API"
            ].map((f) => (
              <div key={f} className="rounded-lg border border-white/15 bg-white/[0.03] p-3">
                <div className="text-emerald-400 text-xs mb-1">✓</div>
                <div className="text-white">{f}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Precio */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="precio" className="border-t border-neutral-200 py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-emerald-600 mb-3 font-semibold">Precio honesto</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Sin mensualidad. Solo cobramos si vos cobrás.
            </h2>
            <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
              Elegí el plan que te convenga. Todos incluyen todos los módulos — no vendemos features aparte.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-8">
              <div className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Gratis</div>
              <div className="text-4xl font-bold">$0</div>
              <p className="text-sm text-neutral-500 mt-1 mb-6">Para siempre · Solo 5% por venta</p>
              <ul className="space-y-2 text-sm mb-8">
                {["Subdominio gratis", "Todos los módulos", "MP directo", "Soporte por tickets"].map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center rounded-full border border-neutral-300 text-neutral-900 py-3 font-semibold hover:border-neutral-900 transition">
                Empezar gratis
              </Link>
            </div>
            {/* Pro (destacado) */}
            <div className="rounded-2xl border-2 border-orange-500 bg-white p-8 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-500 text-white text-xs font-bold px-3 py-1 uppercase tracking-wider">
                Recomendado
              </div>
              <div className="text-sm font-semibold text-orange-500 uppercase tracking-wider mb-2">Pro</div>
              <div className="text-4xl font-bold">$9.900</div>
              <p className="text-sm text-neutral-500 mt-1 mb-6">Por mes · Solo 3% por venta</p>
              <ul className="space-y-2 text-sm mb-8">
                {["Todo lo del plan Gratis", "Dominio propio (CNAME)", "Emails con tu dominio", "Comisión reducida al 3%", "Soporte prioritario"].map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center rounded-full bg-orange-500 text-white py-3 font-semibold hover:bg-orange-600 transition">
                Empezar plan Pro
              </Link>
            </div>
            {/* Enterprise */}
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-8">
              <div className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Enterprise</div>
              <div className="text-4xl font-bold">A medida</div>
              <p className="text-sm text-neutral-500 mt-1 mb-6">Volumen alto · Comisión escalonada</p>
              <ul className="space-y-2 text-sm mb-8">
                {["Todo lo del Pro", "White-label", "Multi-tenant", "SLA + Slack directo", "API custom"].map((f) => (
                  <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{f}</li>
                ))}
              </ul>
              <Link href="/signup" className="block text-center rounded-full border border-neutral-300 text-neutral-900 py-3 font-semibold hover:border-neutral-900 transition">
                Contactar ventas
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CTA final grande */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-200 py-24 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Empezá tu sitio <br />
            <span className="italic font-serif text-orange-600">hoy mismo.</span>
          </h2>
          <p className="text-lg text-neutral-700 mb-10 max-w-xl mx-auto">
            Vendas cursos, remeras, entradas o mentorías. Sin tarjeta. Sin mensualidad. Sin sorpresas.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-full bg-neutral-900 text-white px-10 py-4 text-lg font-semibold hover:bg-neutral-800 transition shadow-xl"
          >
            Crear mi sitio gratis
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Footer denso multi-columna */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <footer className="bg-neutral-900 text-neutral-300 pt-16 pb-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="text-2xl font-bold mb-3">
                <span className="text-white">Offer</span><span className="text-orange-500">Now</span>
              </div>
              <p className="text-sm text-neutral-400 max-w-xs">
                Sites 4 Everything · La plataforma para vender cualquier cosa online, con tu dominio y tu marca.
              </p>
              <div className="mt-6 flex gap-3">
                {["IG", "TW", "YT", "LI"].map((s) => (
                  <a key={s} href="#" className="w-9 h-9 rounded-full border border-neutral-700 flex items-center justify-center text-xs hover:border-white hover:text-white transition">
                    {s}
                  </a>
                ))}
              </div>
            </div>
            {[
              {
                title: "Producto",
                links: ["Features", "Plantillas", "Precio", "Cambios recientes", "Roadmap"]
              },
              {
                title: "Recursos",
                links: ["Demo en vivo", "Documentación", "API", "Estado del servicio", "Blog"]
              },
              {
                title: "Empresa",
                links: ["Sobre OfferNow", "Casos de éxito", "Contacto", "Prensa", "Términos"]
              }
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-white font-semibold mb-4 text-sm">{col.title}</h4>
                <ul className="space-y-2 text-sm">
                  {col.links.map((l) => (
                    <li key={l}><a href="#" className="text-neutral-400 hover:text-white transition">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-neutral-800 pt-6 flex flex-col md:flex-row justify-between gap-4 text-sm text-neutral-500">
            <div>© {new Date().getFullYear()} OfferNow · Sites 4 Everything · Hecho en Argentina 🇦🇷</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white">Términos</a>
              <a href="#" className="hover:text-white">Privacidad</a>
              <a href="#" className="hover:text-white">Cookies</a>
              <span>🌎 Español</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
