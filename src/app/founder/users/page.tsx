import { getServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { FounderUsersTable } from "@/components/founder/FounderUsersTable";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  is_super_admin: boolean;
  moderation_status?: 'active' | 'under_review' | 'suspended';
  created_at: string;
};

export default async function FounderUsersPage() {
  const svc = getServiceClient();
  const supabase = await createSupabaseServerClient();
  const { data: { user: me } } = await supabase.auth.getUser();
  const myId = me?.id ?? null;

  // Defensivo: si migration 0086 no corrió, reintentamos sin moderation_status
  let profilesRaw: Profile[] | null = null;
  let migrationMissing = false;
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('profiles') as any)
      .select('id, email, display_name, is_super_admin, moderation_status, created_at')
      .order('created_at', { ascending: false });
    if (res.error?.message?.includes('moderation_status')) {
      migrationMissing = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const retry = await (svc.from('profiles') as any)
        .select('id, email, display_name, is_super_admin, created_at')
        .order('created_at', { ascending: false });
      profilesRaw = (retry.data ?? []) as Profile[];
    } else {
      profilesRaw = (res.data ?? []) as Profile[];
    }
  }

  const [{ data: memberships }, { data: enrollments }, { data: ownerMembers }] = await Promise.all([
    svc.from('memberships').select('user_id, role').eq('status', 'active'),
    svc.from('enrollments').select('user_id').eq('status', 'active'),
    // Owners con slug del tenant — para el botón "Editar publicaciones"
    svc.from('memberships')
      .select('user_id, tenants ( slug )')
      .eq('role', 'owner').eq('status', 'active')
  ]);

  const profiles = profilesRaw ?? [];
  const ownersByUser = new Map<string, number>();
  const enrollByUser = new Map<string, number>();
  const firstOwnedSlug = new Map<string, string>();
  for (const m of ((memberships ?? []) as Array<{ user_id: string; role: string }>)) {
    if (m.role === 'owner') ownersByUser.set(m.user_id, (ownersByUser.get(m.user_id) ?? 0) + 1);
  }
  for (const e of ((enrollments ?? []) as Array<{ user_id: string }>)) {
    enrollByUser.set(e.user_id, (enrollByUser.get(e.user_id) ?? 0) + 1);
  }
  for (const om of ((ownerMembers ?? []) as Array<{ user_id: string; tenants: { slug: string } | null }>)) {
    if (om.tenants?.slug && !firstOwnedSlug.has(om.user_id)) {
      firstOwnedSlug.set(om.user_id, om.tenants.slug);
    }
  }

  // Enriquecer para la tabla client
  const rows = profiles.map((p) => ({
    id: p.id,
    email: p.email,
    display_name: p.display_name,
    is_super_admin: p.is_super_admin,
    moderation_status: (p.moderation_status ?? 'active') as 'active' | 'under_review' | 'suspended',
    created_at: p.created_at,
    ownerCount: ownersByUser.get(p.id) ?? 0,
    enrollCount: enrollByUser.get(p.id) ?? 0,
    ownedTenantSlug: firstOwnedSlug.get(p.id) ?? null
  }));

  const totalUsers = profiles.length;
  const totalAdmins = profiles.filter((p) => p.is_super_admin).length;
  const totalOwners = ownersByUser.size;
  const totalStudents = Array.from(enrollByUser.keys()).length;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Usuarios</h1>
        <p className="text-white/60 text-sm mt-1">
          Todos los usuarios registrados. Buscá, seleccioná varios para acciones bulk (reactivar, bajo revisión, suspender, eliminar), o usá las acciones por-row (impersonar, editar publicaciones).
        </p>
      </div>

      {migrationMissing && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          ⚠️ Migration <code>0086_moderation_status.sql</code> pendiente — sin eso, los usuarios se ven como "activo" y las acciones bulk de estado no funcionan.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Usuarios totales" value={totalUsers} />
        <Stat label="Super admins" value={totalAdmins} />
        <Stat label="Owners de sitio" value={totalOwners} />
        <Stat label="Alumnos activos" value={totalStudents} />
      </div>

      <FounderUsersTable rows={rows} myId={myId} />
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
