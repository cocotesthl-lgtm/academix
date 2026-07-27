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

  // Defensivo: si la query falla porque moderation_status no está en el
  // schema cache de PostgREST (típicamente 10 min después de la migration
  // o hasta que se recargue el cache manualmente), retryamos sin la columna
  // y flageamos el banner. Nota: "unknown to PostgREST" ≠ "no existe en DB"
  // — la migration puede estar aplicada pero el cache viejo. Por eso el
  // banner apunta al reload del schema, no al SQL.
  let profilesRaw: Profile[] | null = null;
  let schemaCacheStale = false;
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await (svc.from('profiles') as any)
      .select('id, email, display_name, is_super_admin, moderation_status, created_at')
      .order('created_at', { ascending: false });
    if (res.error) {
      schemaCacheStale = true;
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

      {schemaCacheStale && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 space-y-1">
          <p>⚠️ <strong>La columna <code>moderation_status</code> no está en el schema cache de PostgREST.</strong></p>
          <p className="text-amber-200/80 text-xs">
            Si ya corriste la migration <code>0086_moderation_status.sql</code>, el cache está stale.
            Andá a <strong>Supabase Dashboard → Project Settings → API</strong> y clickeá "Reload schema cache",
            o esperá ~10 min. Alternativamente, corré esto en el SQL Editor:
          </p>
          <pre className="bg-black/40 text-amber-100 text-[11px] px-2 py-1 rounded mt-1 font-mono">NOTIFY pgrst, 'reload schema';</pre>
          <p className="text-amber-200/60 text-[11px]">
            Si NO corriste la migration todavía, pegá el contenido de <code>src/db/migrations/0086_moderation_status.sql</code> en el SQL Editor.
          </p>
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
