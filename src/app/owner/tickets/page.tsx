import Link from "next/link";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type TicketRow = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  last_message_at: string;
  created_at: string;
};

export default async function OwnerTickets() {
  const { tenant } = await requireOwner();
  const svc = getServiceClient();
  const { data } = await svc
    .from("support_tickets")
    .select("id, subject, status, priority, last_message_at, created_at")
    .eq("tenant_id", tenant.id)
    .order("last_message_at", { ascending: false });
  const rows = (data ?? []) as TicketRow[];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Soporte</h1>
          <p className="text-white/60 text-sm mt-1">Tus conversaciones con el equipo de Curplat.</p>
        </div>
        <Link
          href="/tickets/new"
          className="rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90"
        >
          + Nuevo ticket
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-white/50 text-sm">
            No abriste ningún ticket todavía.
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((t) => (
              <li key={t.id}>
                <Link href={`/tickets/${t.id}`} className="block px-5 py-4 hover:bg-white/[0.02]">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-medium">{t.subject}</h3>
                      <p className="text-xs text-white/40 mt-1">
                        Última actividad: {new Date(t.last_message_at).toLocaleString('es-AR')}
                      </p>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    open: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    pending: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    closed: 'border-white/15 text-white/40'
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border ${m[status] ?? 'border-white/15'}`}>
      {status}
    </span>
  );
}
