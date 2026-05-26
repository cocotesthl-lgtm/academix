export default function MarketingHome() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold">Curplat</h1>
      <p className="mt-4 text-lg opacity-80">
        La plataforma para academias, coaches y creators de LatAm.
      </p>
      <div className="mt-8 flex gap-4">
        <a href="/signup" className="rounded-md bg-black text-white px-4 py-2">
          Crear mi academia
        </a>
        <a href="/login" className="rounded-md border px-4 py-2">
          Iniciar sesión
        </a>
      </div>
    </main>
  );
}
