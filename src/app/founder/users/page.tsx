import { getServiceClient } from "@/lib/supabase/service";
import { toggleSuperAdminAction } from "@/lib/founder/actions";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_super_admin: boolean;
  created_at: string;
};

export default async function FounderUsersPage() {
  const svc = getServiceClient();

  const [{ data: profilesRaw }, { data: memberships }, { data: enrollments }] = await Promise.all([
    svc.from('profiles')
      .select('id, email, display_name, is_super_admin, created_at')
      .order('created_at', { ascending: false }),
    svc.from('memberships').select('user_id, role').eq('status', 'active'),
    svc.from('enrollments').select('user_id').eq('status', 'active')
  ]);

  const profiles = (profilesRaw ?? []) as Profile[];

  const ownersByUser = new Map<string, number>();
  const enrollByUser = new Map<string, number>();
  for (const m of ((memberships ?? []) as Array<{ user_id: string; role: string }>)) {
    if (m.role === 'owner') ownersByUser.set(m.user_id, (ownersByUser.get(m.user_id) ?? 0) + 1);
  }
  for (const e of ((enrollments ?? []) as Array<{ user_id: string }>)) {
    enrollByUser.set(e.user_id, (enrollByUser.get(e.user_id) ?? 0) + 1);
  }

  const totalUsers = profiles.length;
  const totalAdmins = profiles.filter((p) => p.is_super_admin).length;
  const totalOwners = ownersByUser.size;
  const totalStudents = Array.from(enrollByUser.keys()).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-white/60 text-sm mt-1">
          Todos los usuarios registrados en la plataforma.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Usuarios totales" value={totalUsers} />
        <Stat label="Super admins" value={totalAdmins} />
        <Stat label="Owners de academia" value={totalOwners} />
        <Stat label="Alumnos activos" value={totalStudents} />
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {profiles.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">Sin usuarios todavía.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2.5">Nombre</th>
                <th className="text-left px-4 py-2.5">Email</th>
                <th className="text-left px-4 py-2.5">Rol</th>
                <th className="text-left px-4 py-2.5">Academias</th>
                <th className="text-left px-4 py-2.5">Inscripciones</th>
                <th className="text-left px-4 py-2.5">Alta</th>
                <th className="text-right px-4 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const ownerCount = ownersByUser.get(p.id) ?? 0;
                const enrollCount = enrollByUser.get(p.id) ?? 0;
                return (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium">{p.display_name ?? '—'}</td>
                    <td className="px-4 py-3 text-white/60">{p.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      {p.is_super_admin
                        ? <span className="text-xs px-2 py-0.5 rounded border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300">super_admin</span>
                        : ownerCount > 0
                          ? <span className="text-xs px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">owner</span>
                          : enrollCount > 0
                            ? <span className="text-xs px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300">alumno</span>
                            : <span className="text-xs text-white/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-white/70">{ownerCount}</td>
                    <td className="px-4 py-3 text-white/70">{enrollCount}</td>
                    <td className="px-4 py-3 text-white/50">{new Date(p.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={toggleSuperAdminAction}>
                        <input type="hidden" name="profile_id" value={p.id} />
                        <button
                          className={`text-xs rounded border px-2 py-1 ${
                            p.is_super_admin
                              ? 'border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                              : 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:bg-fuchsia-500/20'
                          }`}
                        >
                          {p.is_super_admin ? 'Quitar admin' : 'Hacer admin'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs text-white/50 uppercase tracking-wider">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
