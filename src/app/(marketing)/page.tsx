import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { GoogleOneTapButton } from "@/components/auth/GoogleOneTapButton";

export const dynamic = "force-dynamic";

export default async function MarketingHome() {
  // Si el user NO está logueado, dispara el widget One Tap flotante
  // (esquina superior derecha) tipo Wix — sin que el user tenga que
  // apretar nada. Si ya está logueado, no se muestra nada.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const showOneTap = !user;

  return (
    <div className="min-h-screen bg-[#fafafa] text-neutral-900">
      {showOneTap && <GoogleOneTapButton showButton={false} next="/" />}
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-neutral-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            {/* Wordmark del logo — sobre fondo claro usa gris oscuro + naranja */}
            <span className="text-neutral-900">Offer</span><span className="text-orange-500">Now</span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-neutral-600">
            <a href="#beneficios" className="hover:text-neutral-900 transition">Beneficios</a>
            <a href="#como-funciona" className="hover:text-neutral-900 transition">Cómo funciona</a>
            <a href="#para-quien" className="hover:text-neutral-900 transition">Para quién</a>
            <a href="#precio" className="hover:text-neutral-900 transition">Precio</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/buscar" className="text-sm text-neutral-600 hover:text-neutral-900">
              🔑 Acceder
            </Link>
            <Link
              href="/signup"
              className="text-sm rounded-md bg-neutral-900 text-white px-4 py-2 font-medium hover:bg-neutral-800 transition"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] bg-gradient-to-br from-orange-300/30 via-amber-200/20 to-orange-400/10 blur-3xl rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 mb-8 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Beta abierta · Argentina · LatAm
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Creá tu propia <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 bg-clip-text text-transparent">
              plataforma web.
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto">
            Vendé <strong className="text-neutral-900">lo que quieras</strong>: cursos, productos físicos, eventos con tickets,
            reservas, mentorías, gift cards, suscripciones. Todo en tu propio dominio, con tu marca,
            cobrando directo a tu MercadoPago.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md bg-neutral-900 text-white px-8 py-3.5 font-semibold hover:bg-neutral-800 transition shadow-lg shadow-neutral-900/20"
            >
              Crear mi plataforma gratis
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto rounded-md border border-neutral-300 bg-white px-8 py-3.5 font-semibold text-neutral-900 hover:bg-neutral-50 transition"
            >
              Ver demo en vivo →
            </Link>
          </div>
          <p className="mt-6 text-xs text-neutral-500">
            Sin tarjeta · Sin mensualidades · 5% por venta (ajustable)
          </p>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="border-t border-neutral-200 py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Beneficios</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Todo lo que necesitás para vender online.
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              No es un builder más. Es el sistema operativo de tu negocio — de una remera hasta un curso.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🛒",
                title: "Vendé cualquier cosa",
                body: "Cursos, productos físicos con stock y variantes, entradas para eventos, mentorías, reservas de restaurante, gift cards, suscripciones. Un solo panel para todo.",
              },
              {
                icon: "🌐",
                title: "Tu dominio, tu marca",
                body: "tunegocio.com con tu logo y tus colores. Tus clientes te ven a vos, no a nosotros. Editor de páginas tipo Wix, sin código.",
              },
              {
                icon: "💳",
                title: "Cobrás vos, directo",
                body: "Conectás tu MercadoPago con un click. La plata entra directo a tu cuenta. Nosotros cobramos solo una comisión sobre ventas confirmadas.",
              },
              {
                icon: "📦",
                title: "Ecommerce físico completo",
                body: "Productos con variantes, stock automático, zonas de envío por provincia, tarifas por peso, órdenes con tracking, scanner de barras + etiquetas imprimibles.",
              },
              {
                icon: "🚀",
                title: "Marketing built-in",
                body: "Afiliados multinivel con tracking, cupones, gift cards con QR, blog/CMS, formularios y CRM con pipeline. Todo integrado — sin plugins ni extras.",
              },
              {
                icon: "📊",
                title: "Analytics + soporte real",
                body: "Funnel de conversión, top productos, ingresos por canal. Sistema de tickets con respuesta del equipo fundador. No bots, no esperas.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-neutral-200 bg-white p-6 hover:border-neutral-900 hover:shadow-md transition"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section id="para-quien" className="border-t border-neutral-200 py-24 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-amber-600 mb-3 font-semibold">Para quién</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Pensado para negocios de LatAm.
            </h2>
            <p className="mt-4 text-lg text-neutral-600 max-w-2xl mx-auto">
              Si vendés algo — físico o digital — necesitás un sitio profesional.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "🛍️ Tiendas físicas", body: "Indumentaria, deco, librerías, kioscos. Stock + envíos + scanner + etiquetas + gift cards." },
              { title: "🎓 Cursos y academias", body: "Videos por Drive, comunidades, mentorías 1-a-1, membresías. Sin pagar Kajabi en dólares." },
              { title: "🎟️ Eventos y venues", body: "Entradas con QR, reservas de restaurante o cancha, gestión de asientos numerados." },
              { title: "💇 Servicios y coaches", body: "Turnos, reservas por sede, packs de sesiones, propinas. Todo con MercadoPago." },
              { title: "💎 Creators y VIP content", body: "Membresías, suscripciones mensuales, contenido bloqueado tipo OnlyFans, DMs con fans." },
              { title: "📰 Editoriales y blogs", body: "CMS integrado con SEO, sitemap.xml y RSS. Publicá noticias y monetizá el tráfico." },
              { title: "🛠️ Freelancers y agencias", body: "Vendé servicios con checkout, formularios de brief, CRM de leads y afiliados." },
              { title: "🍽️ Gastronomía", body: "Menú digital, reservas con QR, gift cards, WhatsApp integrado, delivery con envío por provincia." },
            ].map((p) => (
              <div key={p.title} className="rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-900 hover:shadow-sm transition">
                <h3 className="font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-neutral-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-t border-neutral-200 py-24 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-orange-500 mb-3 font-semibold">Cómo funciona</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Listo en menos de 10 minutos.
            </h2>
          </div>
          <ol className="space-y-6">
            {[
              {
                n: "01",
                title: "Creás tu cuenta y elegís tu subdominio",
                body: "tunegocio.bzseguridad.store — único, gratis, tuyo. Subís tu logo y elegís tus colores. Después conectás tu dominio propio si querés.",
              },
              {
                n: "02",
                title: "Conectás tu MercadoPago",
                body: "OAuth con un click. La plata de cada venta entra directo a tu cuenta. Sin intermediarios ni holds.",
              },
              {
                n: "03",
                title: "Elegís qué vender y activás módulos",
                body: "Cursos con Google Drive, productos físicos con stock, entradas con QR, gift cards, reservas. Solo activás lo que usás.",
              },
              {
                n: "04",
                title: "Empezás a vender el mismo día",
                body: "Tu primera venta puede llegar en horas. Sumás afiliados que te traen tráfico y usás analytics para optimizar.",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="flex gap-6 rounded-2xl border border-neutral-200 bg-[#fafafa] p-6"
              >
                <div className="text-3xl font-bold text-neutral-300 shrink-0">{s.n}</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                  <p className="text-neutral-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Precio */}
      <section id="precio" className="border-t border-neutral-200 py-24 bg-[#fafafa]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm uppercase tracking-widest text-emerald-600 mb-3 font-semibold">Precio honesto</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Sin mensualidad. Solo cobramos si vos cobrás.
          </h2>
          <p className="text-lg text-neutral-600 mb-12 max-w-2xl mx-auto">
            5% sobre cada venta confirmada. Si no vendés, no pagás nada. Sin tarjetas,
            sin pruebas que se vencen, sin sorpresas.
          </p>
          <div className="inline-flex flex-col sm:flex-row gap-6 items-center justify-center rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 p-10 shadow-sm">
            <div className="text-left">
              <div className="text-6xl font-bold tracking-tight">
                5<span className="text-3xl align-top">%</span>
              </div>
              <p className="text-sm text-neutral-600 mt-1">por venta · sin fee mensual</p>
            </div>
            <div className="hidden sm:block w-px h-20 bg-neutral-300" />
            <Link
              href="/signup"
              className="rounded-md bg-neutral-900 text-white px-8 py-3.5 font-semibold hover:bg-neutral-800 transition"
            >
              Crear mi plataforma
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-neutral-200 py-24 bg-white">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            ¿Listo para tener tu propio sitio?
          </h2>
          <p className="text-lg text-neutral-600 mb-10">
            Vendas cursos, remeras, entradas o mentorías — creá tu cuenta gratis y configurá todo hoy mismo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md bg-neutral-900 text-white px-8 py-3.5 font-semibold hover:bg-neutral-800 transition shadow-lg shadow-neutral-900/20"
            >
              Empezar gratis
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto rounded-md border border-neutral-300 bg-white px-8 py-3.5 font-semibold text-neutral-900 hover:bg-neutral-50 transition"
            >
              Ver demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-10 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
          <div>© {new Date().getFullYear()} OfferNow · Sites 4 Everything · Hecho en Argentina.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-neutral-900">Términos</a>
            <a href="#" className="hover:text-neutral-900">Privacidad</a>
            <a href="#" className="hover:text-neutral-900">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
