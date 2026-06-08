import { requireInstructor } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";

export const dynamic = "force-dynamic";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await requireInstructor();
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-60 border-r border-white/10 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">👨‍🏫 Instructor</h2>
          <p className="text-xs text-white/40">{tenant.name}</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor">Dashboard</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/courses">Mis cursos</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/schedule">Agenda</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/availability">Mi disponibilidad</a>
        </nav>
        <div className="mt-auto pt-4 border-t border-white/10">
          <SignoutButton />
        </div>
      </aside>
      <main className="flex-1">
        <div className="px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
