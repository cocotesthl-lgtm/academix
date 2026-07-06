import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleOneTapButton } from "@/components/auth/GoogleOneTapButton";
import { DomainChecker } from "@/components/marketing/DomainChecker";

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
            <Link href="/buscar" className="text-sm text-neutral-700 hover:text-neutral-900 font-medium">
              Acceder
            </Link>
            <Link
              href="/signup"
              className="text-sm rounded-full bg-orange-500 text-white px-5 py-2 font-semibold hover:bg-orange-600 transition"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Hero — centrado con mockup */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden pt-16 pb-12">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 mb-6 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Beta abierta · Argentina · LatAm
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05]">
            OfferNow, como <br className="hidden md:inline" />
            <span className="italic font-serif text-orange-500">debe ser.</span>
          </h1>
          <p className="mt-8 text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto leading-relaxed">
            Un solo sistema para vender cualquier cosa online — cursos, productos físicos, entradas,
            gift cards, mentorías, reservas. Sin mensualidades, con tu dominio, cobrando directo a MercadoPago.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-full bg-orange-500 text-white px-8 py-4 text-base font-semibold hover:bg-orange-600 transition"
            >
              Empezar ahora
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto rounded-full border border-neutral-300 bg-white text-neutral-900 px-8 py-4 text-base font-semibold hover:border-neutral-900 transition"
            >
              Ver demo en vivo
            </Link>
          </div>
          <p className="mt-5 text-xs text-neutral-500">Sin tarjeta · Sin mensualidades · 5% por venta</p>
        </div>

        {/* Mockup del producto — browser frame con dashboard adentro */}
        <div className="max-w-6xl mx-auto px-6 mt-16">
          <BrowserMockup />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* Confía en el mejor sistema — features verticales */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="features" className="border-t border-neutral-200 py-24 bg-[#fafafa]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Sistema completo</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Todo integrado, sin plugins.
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              Otras plataformas te venden el sitio y te cobran aparte por cada módulo. Acá está todo.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                title: "Vendé cualquier cosa",
                body: "Cursos con videos por Drive, productos físicos con stock y variantes, entradas con QR, gift cards, reservas de mesa, mentorías, membresías. Un panel para todo.",
                stat: "10+ tipos de producto"
              },
              {
                title: "Cobrás vos, directo a MercadoPago",
                body: "OAuth con un click. La plata de cada venta entra a tu cuenta. Nosotros cobramos comisión solo sobre ventas confirmadas — nunca por adelantado.",
                stat: "0 pesos por adelantado"
              },
              {
                title: "Sin costos de almacenamiento",
                body: "Conectás tu Google Drive y cargás lo que quieras. No cobramos por GB ni por video. Usás tu propio espacio, sin límites artificiales.",
                stat: "Espacio ilimitado"
              },
              {
                title: "Marketing built-in",
                body: "Afiliados multinivel de 3 niveles, cupones, gift cards con QR, CRM con pipeline, formularios conectados, blog con SEO, analytics de funnel.",
                stat: "12 módulos incluidos"
              }
            ].map((f, i) => (
              <div
                key={f.title}
                className="grid md:grid-cols-[1fr_2fr_auto] gap-6 items-center rounded-2xl border border-neutral-200 bg-white p-6 hover:border-neutral-900 hover:shadow-md transition"
              >
                <div className="text-2xl font-bold text-neutral-300 shrink-0">
                  0{i + 1}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1.5">{f.title}</h3>
                  <p className="text-neutral-600 leading-relaxed">{f.body}</p>
                </div>
                <div className="text-sm font-semibold text-orange-500 whitespace-nowrap">
                  {f.stat}
                </div>
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

/**
 * Mockup del producto — browser frame CSS puro con dashboard estilizado
 * adentro. Sin dependencia de imágenes externas.
 */
function BrowserMockup() {
  return (
    <div className="rounded-t-2xl md:rounded-2xl border border-neutral-200 bg-white shadow-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-100 border-b border-neutral-200">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 mx-4 rounded-md bg-white border border-neutral-200 px-3 py-1 text-xs text-neutral-500">
          🔒 miNegocio.bzseguridad.store
        </div>
        <div className="w-6 h-6 rounded bg-neutral-200" />
      </div>

      {/* Dashboard content */}
      <div className="grid md:grid-cols-[220px_1fr] min-h-[420px]">
        {/* Sidebar */}
        <div className="hidden md:block bg-[#0a0a0a] text-white p-4">
          <div className="text-sm font-bold mb-6">
            <span className="text-white">Offer</span><span className="text-orange-500">Now</span>
          </div>
          <div className="space-y-1">
            {[
              { label: "Inicio", active: true },
              { label: "Catálogo" },
              { label: "Ventas" },
              { label: "Ecommerce" },
              { label: "Analytics" },
              { label: "Marketing" },
              { label: "Configuración" }
            ].map((item) => (
              <div key={item.label}
                className={`px-2 py-1.5 rounded text-xs ${item.active ? "bg-white/10 text-white font-medium" : "text-white/60"}`}>
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="p-6 bg-white">
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="text-xl font-bold">Dashboard</h3>
            <span className="text-xs text-neutral-500">Últimos 30 días</span>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Ingresos", value: "$284.500", change: "+18%" },
              { label: "Órdenes", value: "126", change: "+24%" },
              { label: "Conversión", value: "3.4%", change: "+0.8%" }
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-neutral-200 p-3">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">{k.label}</div>
                <div className="text-xl font-bold mt-1">{k.value}</div>
                <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{k.change}</div>
              </div>
            ))}
          </div>

          {/* Fake chart */}
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="text-xs font-semibold text-neutral-700 mb-3">Ventas por día</div>
            <div className="flex items-end gap-1 h-24">
              {[40, 55, 30, 65, 45, 70, 60, 80, 50, 90, 75, 95, 85, 70].map((h, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-orange-400 to-orange-300 rounded-t"
                  style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>

          {/* Order list */}
          <div className="mt-4 rounded-lg border border-neutral-200 p-4">
            <div className="text-xs font-semibold text-neutral-700 mb-2">Últimas órdenes</div>
            <div className="space-y-1.5">
              {[
                { name: "Remera básica · M", price: "$4.500", status: "pagada" },
                { name: "Curso de inglés A1", price: "$9.900", status: "pagada" },
                { name: "Reserva mesa · Sáb 20hs", price: "$2.000", status: "pendiente" }
              ].map((o, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-700">{o.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-neutral-900">{o.price}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                      o.status === "pagada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>{o.status}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
