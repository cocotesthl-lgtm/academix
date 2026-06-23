import { requireInstructor } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";
import { SignoutButton } from "@/components/auth/SignoutButton";

export const dynamic = "force-dynamic";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { tenant, userId } = await requireInstructor();
  // Si también es afiliado de Curplat, mostramos un link al panel global
  const svc = getServiceClient();
  const { data: prof } = await svc
    .from('profiles').select('is_affiliate').eq('id', userId)
    .maybeSingle<{ is_affiliate: boolean }>();
  const isAffiliate = !!prof?.is_affiliate;
  // Las URLs cross-subdominio: afiliado vive en el apex (bzseguridad.store)
  const apexUrl = (() => {
    try {
      const u = new URL(env.appUrl);
      if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost')) return u.origin;
      return `${u.protocol}//${env.rootDomain}`;
    } catch { return env.appUrl; }
  })();
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-60 border-r border-white/10 p-4 flex flex-col">
        <div className="mb-6">
          <h2 className="font-bold text-lg">👨‍🏫 Instructor</h2>
          <p className="text-xs text-white/40">{tenant.name}</p>
        </div>
        <nav className="flex flex-col gap-1 text-sm">
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor">Dashboard</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/courses">Mis publicaciones</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/schedule">Agenda</a>
          <a className="rounded px-2 py-1.5 hover:bg-white/5" href="/instructor/availability">Mi disponibilidad</a>
        </nav>
        {isAffiliate && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2 px-2">También sos</p>
            <a
              href={`${apexUrl}/affiliate`}
              className="rounded px-2 py-1.5 hover:bg-white/5 text-sm flex items-center gap-2 text-fuchsia-200"
            >
              💼 Panel de afiliado →
            </a>
          </div>
        )}
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
