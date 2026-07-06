import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { inviteTeamMemberAction, removeTeamMemberAction } from "@/lib/team/actions";
import { normalizePermissions } from "@/lib/permissions/types";
import { MemberPermissionsEditor } from "@/components/owner/team/MemberPermissionsEditor";

export const dynamic = "force-dynamic";

type MembershipRow = {
  user_id: string;
  role: string;
  status: string;
  created_at: string;
  permissions: unknown;
  profiles: { id: string; email: string | null; display_name: string | null } | null;
};

export default async function TeamPage() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: memRaw } = await svc
    .from('memberships')
    .select('user_id, role, status, created_at, permissions, profiles ( id, email, display_name )')
    .eq('tenant_id', tenant.id)
    .in('role', ['owner', 'admin', 'staff'])
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  const members = (memRaw ?? []) as unknown as MembershipRow[];
  const ownerEmails = new Set(
    members.filter((m) => m.role === 'owner').map((m) => m.profiles?.email).filter(Boolean) as string[]
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">👥 Equipo</h1>
        <p className="text-white/60 text-sm mt-1">
          Sumá personas a tu equipo. Cada miembro puede ver y gestionar los leads del CRM (asignarse,
          comentar, mover entre etapas). El dueño de la cuenta (vos) siempre tiene acceso total.
        </p>
      </div>

      <form
        action={inviteTeamMemberAction}
        className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3"
      >
        <h2 className="font-semibold text-sm">Invitar a un miembro</h2>
        <p className="text-[11px] text-white/55">
          La persona debe haberse registrado antes en OfferNow (con cualquier email).
          Después invitala desde acá usando ese email.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            name="email"
            type="email"
            required
            placeholder="email@ejemplo.com"
            className="flex-1 min-w-[240px] rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          />
          <select
            name="role"
            defaultValue="staff"
            className="rounded bg-white/5 border border-white/15 px-3 py-2 text-sm"
          >
            <option value="staff">Staff (gestiona leads)</option>
            <option value="admin">Admin (puede invitar)</option>
          </select>
          <button className="rounded bg-white text-black px-4 py-2 text-sm font-semibold hover:bg-white/90">
            + Invitar
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="font-semibold text-sm mb-3">Miembros activos ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-xs text-white/40">Sin miembros aún.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {members.map((m) => {
              const email = m.profiles?.email ?? '—';
              const displayName = m.profiles?.display_name || email;
              const isOwner = m.role === 'owner';
              const isAlsoOwner = ownerEmails.has(email);
              const perms = normalizePermissions(m.permissions);
              return (
                <li key={`${m.user_id}-${m.role}`} className="py-3 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: roleColor(m.role) }}
                      >
                        {(displayName ?? '?').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{displayName}</div>
                        <div className="text-[11px] text-white/45 truncate">{email}</div>
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded"
                        style={{ background: `${roleColor(m.role)}33`, color: roleColor(m.role) }}
                      >
                        {m.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <MemberPermissionsEditor
                        userId={m.user_id}
                        initial={perms}
                        disabled={isOwner || isAlsoOwner}
                      />
                      {!isOwner && !isAlsoOwner && (
                        <form action={removeTeamMemberAction}>
                          <input type="hidden" name="user_id" value={m.user_id} />
                          <input type="hidden" name="role" value={m.role} />
                          <button
                            type="submit"
                            className="text-xs px-2 py-1 rounded border border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
                          >
                            Quitar
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function roleColor(role: string): string {
  switch (role) {
    case 'owner': return '#f59e0b';
    case 'admin': return '#f97316';
    case 'staff': return '#3b82f6';
    default: return '#888888';
  }
}
