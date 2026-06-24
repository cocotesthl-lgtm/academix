export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3 text-black/50">
        <div className="w-10 h-10 rounded-full border-2 border-black/15 border-t-black animate-spin" />
        <div className="text-xs uppercase tracking-widest">Cargando…</div>
      </div>
    </div>
  );
}
