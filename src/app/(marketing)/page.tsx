import Link from "next/link";

export default function MarketingHome() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Curplat
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#beneficios" className="hover:text-white transition">Beneficios</a>
            <a href="#como-funciona" className="hover:text-white transition">Cómo funciona</a>
            <a href="#para-quien" className="hover:text-white transition">Para quién</a>
            <a href="#precio" className="hover:text-white transition">Precio</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/80 hover:text-white">Iniciar sesión</Link>
            <Link
              href="/signup"
              className="text-sm rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90 transition"
            >
              Empezar gratis
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-br from-fuchsia-600/30 via-purple-600/20 to-blue-600/30 blur-3xl rounded-full" />
        </div>
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs text-white/80 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Beta abierta · Argentina · LatAm
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
            Tu academia, <br className="hidden md:inline" />
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
              tu propia plataforma.
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
            Vendé cursos, gestioná alumnos, crecé con afiliados. Todo en tu subdominio,
            con tu marca, cobrando directo a tu MercadoPago o Shopify.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md bg-white text-black px-8 py-3.5 font-semibold hover:bg-white/90 transition shadow-lg shadow-white/10"
            >
              Crear mi academia gratis
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto rounded-md border border-white/20 bg-white/5 px-8 py-3.5 font-semibold hover:bg-white/10 transition"
            >
              Ver demo en vivo →
            </Link>
          </div>
          <p className="mt-6 text-xs text-white/50">
            Sin tarjeta · Sin mensualidades · 5% por venta (ajustable)
          </p>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="border-t border-white/10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-fuchsia-400 mb-3">Beneficios</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Todo lo que necesitás para vender educación.
            </h2>
            <p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">
              No es un LMS más. Es el sistema operativo de tu negocio educativo.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: "🌐",
                title: "Tu subdominio propio",
                body: "tunombre.curplat.com con tu logo, tus colores y tu identidad. Tus alumnos te ven a vos, no a nosotros.",
              },
              {
                icon: "💳",
                title: "Cobrás vos, directo",
                body: "Conectás tu MercadoPago o tu Shopify. La plata entra a tu cuenta. Nosotros solo cobramos comisión sobre las ventas reales.",
              },
              {
                icon: "🚀",
                title: "Afiliados multinivel",
                body: "Sistema viral de 3 niveles con tracking, cookies y antifraude. Tus alumnos te traen alumnos.",
              },
              {
                icon: "📁",
                title: "Sin costos de almacenamiento",
                body: "Conectás tu Google Drive y subís lo que quieras. No te cobramos por GB ni por video — usás tu propio espacio.",
              },
              {
                icon: "📊",
                title: "Panel de finanzas claro",
                body: "Ves cada venta, cada comisión, cada afiliado pago. Sin sorpresas, sin letra chica.",
              },
              {
                icon: "💬",
                title: "Soporte directo",
                body: "Sistema de tickets con respuesta del equipo fundador. No bots, no esperas eternas.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] hover:border-white/20 transition"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section id="para-quien" className="border-t border-white/10 py-24 bg-gradient-to-b from-transparent to-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-purple-400 mb-3">Para quién</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Pensado para creators de LatAm.
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Academias", body: "Que ya venden cursos y necesitan estructura, marca y crecimiento." },
              { title: "Coaches y mentores", body: "Mentorías 1 a 1, grupales y masterminds — en un solo lugar." },
              { title: "Profesores y instructores", body: "Que quieren su propia plataforma sin pagar Kajabi en dólares." },
              { title: "Creators y comunidades", body: "Monetizá tu audiencia con cursos, membresías y eventos." },
            ].map((p) => (
              <div key={p.title} className="rounded-xl border border-white/10 p-5">
                <h3 className="font-semibold mb-2">{p.title}</h3>
                <p className="text-sm text-white/60">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-t border-white/10 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-widest text-blue-400 mb-3">Cómo funciona</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Listo en menos de 10 minutos.
            </h2>
          </div>
          <ol className="space-y-6">
            {[
              {
                n: "01",
                title: "Creás tu cuenta y elegís tu subdominio",
                body: "miacademia.curplat.com — único, gratis, tuyo. Subís tu logo y elegís tus colores.",
              },
              {
                n: "02",
                title: "Conectás tu pasarela de pago",
                body: "MercadoPago o Shopify, con un click. La plata de cada venta entra directo a tu cuenta.",
              },
              {
                n: "03",
                title: "Cargás tus cursos desde Google Drive",
                body: "Conectás tu Drive y elegís los videos. Nosotros nunca tocamos tus archivos.",
              },
              {
                n: "04",
                title: "Empezás a vender y a sumar afiliados",
                body: "Tu primer alumno puede comprar el mismo día. Los afiliados generan su link y te traen ventas.",
              },
            ].map((s) => (
              <li
                key={s.n}
                className="flex gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6"
              >
                <div className="text-3xl font-bold text-white/30 shrink-0">{s.n}</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{s.title}</h3>
                  <p className="text-white/60">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Precio */}
      <section id="precio" className="border-t border-white/10 py-24 bg-gradient-to-b from-white/[0.02] to-transparent">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-sm uppercase tracking-widest text-emerald-400 mb-3">Precio honesto</p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Sin mensualidad. Solo cobramos si vos cobrás.
          </h2>
          <p className="text-lg text-white/60 mb-12 max-w-2xl mx-auto">
            5% sobre cada venta confirmada. Si no vendés, no pagás nada. Sin tarjetas,
            sin pruebas que se vencen, sin sorpresas.
          </p>
          <div className="inline-flex flex-col sm:flex-row gap-6 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-fuchsia-500/10 via-purple-500/10 to-blue-500/10 p-10">
            <div className="text-left">
              <div className="text-6xl font-bold tracking-tight">
                5<span className="text-3xl align-top">%</span>
              </div>
              <p className="text-sm text-white/60 mt-1">por venta · sin fee mensual</p>
            </div>
            <div className="hidden sm:block w-px h-20 bg-white/20" />
            <Link
              href="/signup"
              className="rounded-md bg-white text-black px-8 py-3.5 font-semibold hover:bg-white/90 transition"
            >
              Crear mi academia
            </Link>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-white/10 py-24">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            ¿Listo para tener tu academia propia?
          </h2>
          <p className="text-lg text-white/60 mb-10">
            Creá tu cuenta gratis y configurá tu plataforma hoy mismo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-md bg-white text-black px-8 py-3.5 font-semibold hover:bg-white/90 transition shadow-lg shadow-white/10"
            >
              Empezar gratis
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto rounded-md border border-white/20 bg-white/5 px-8 py-3.5 font-semibold hover:bg-white/10 transition"
            >
              Ver demo
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
          <div>© {new Date().getFullYear()} Curplat. Hecho en Argentina.</div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-white">Términos</a>
            <a href="#" className="hover:text-white">Privacidad</a>
            <a href="#" className="hover:text-white">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
