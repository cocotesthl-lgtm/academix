import Link from "next/link";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Banner demo */}
      <div className="bg-gradient-to-r from-orange-600 via-orange-600 to-blue-600 text-center text-sm py-2.5 px-4">
        🎬 Estás viendo una demo. Así se ve un sitio real en OfferNow.{" "}
        <Link href="/signup" className="underline font-semibold hover:no-underline">
          Crear la tuya gratis →
        </Link>
      </div>

      {/* Storefront mock (estilo sitio real) */}
      <div className="bg-white text-black">
        {/* Header de el sitio */}
        <header className="border-b border-black/10 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold">
                MV
              </div>
              <div>
                <div className="font-bold">Mariana Vega</div>
                <div className="text-xs text-black/50">Sitio de Diseño UX</div>
              </div>
            </div>
            <nav className="hidden md:flex gap-6 text-sm">
              <a href="#" className="font-medium">Publicaciones</a>
              <a href="#" className="text-black/60 hover:text-black">Mentorías</a>
              <a href="#" className="text-black/60 hover:text-black">Comunidad</a>
              <a href="#" className="text-black/60 hover:text-black">Sobre mí</a>
            </nav>
            <button className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium">
              Iniciar sesión
            </button>
          </div>
        </header>

        {/* Hero sitio */}
        <section className="px-6 py-16 bg-gradient-to-b from-orange-50 to-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Aprendé UX con casos reales.
            </h1>
            <p className="mt-4 text-lg text-black/60 max-w-xl mx-auto">
              Publicaciones pensados para diseñadores que quieren laburar en producto digital.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <div className="flex -space-x-2">
                {["bg-blue-300", "bg-green-300", "bg-pink-300", "bg-yellow-300"].map((c, i) => (
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-white ${c}`} />
                ))}
              </div>
              <p className="text-sm text-black/60">+2.400 alumnos formados</p>
            </div>
          </div>
        </section>

        {/* Catálogo */}
        <section className="px-6 py-16">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold mb-8">Publicaciones disponibles</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "UX Research desde cero",
                  desc: "Entrevistas, encuestas, validación. 8 horas de contenido + plantillas.",
                  price: "$24.900",
                  badge: "Más vendido",
                  gradient: "from-orange-400 to-pink-500",
                },
                {
                  title: "Figma profesional",
                  desc: "De principiante a auto-layout y componentes avanzados. 12 horas.",
                  price: "$19.900",
                  badge: null,
                  gradient: "from-amber-400 to-blue-500",
                },
                {
                  title: "Portfolio que consigue trabajo",
                  desc: "Cómo armar un portfolio que te diferencie. Incluye revisión 1 a 1.",
                  price: "$34.900",
                  badge: "Nuevo",
                  gradient: "from-emerald-400 to-teal-500",
                },
              ].map((course) => (
                <div
                  key={course.title}
                  className="rounded-xl border border-black/10 overflow-hidden hover:shadow-lg transition"
                >
                  <div className={`h-40 bg-gradient-to-br ${course.gradient} relative`}>
                    {course.badge && (
                      <span className="absolute top-3 left-3 bg-white text-black text-xs font-semibold px-2 py-1 rounded">
                        {course.badge}
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-semibold mb-2">{course.title}</h3>
                    <p className="text-sm text-black/60 mb-4">{course.desc}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{course.price}</span>
                      <button className="rounded-md bg-black text-white px-4 py-2 text-sm font-medium">
                        Comprar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer sitio */}
        <footer className="border-t border-black/10 px-6 py-8 text-center text-sm text-black/50">
          © 2026 Mariana Vega · Sitio de Diseño UX
        </footer>
      </div>

      {/* CTA volver al marketing */}
      <section className="py-20 text-center px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          Tu sitio puede verse así.
        </h2>
        <p className="text-white/60 mb-8 max-w-xl mx-auto">
          Con tu marca, tus colores, tu dominio. Creala gratis ahora — en 10 minutos
          la tenés andando.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/signup"
            className="rounded-md bg-white text-black px-8 py-3.5 font-semibold hover:bg-white/90 transition"
          >
            Crear mi sitio gratis
          </Link>
          <Link
            href="/"
            className="rounded-md border border-white/20 bg-white/5 px-8 py-3.5 font-semibold hover:bg-white/10 transition"
          >
            ← Volver
          </Link>
        </div>
      </section>
    </div>
  );
}
