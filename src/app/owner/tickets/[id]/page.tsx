import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/guards";
import { getServiceClient } from "@/lib/supabase/service";
import { ReplyForm } from "@/components/tickets/ReplyForm";

export const dynamic = "force-dynamic";

type Ticket = { id: string; subject: string; status: string; created_at: string; tenant_id: string };
type Message = {
  id: string;
  body: string;
  created_at: string;
  author_user_id: string;
  profiles: { display_name: string | null; email: string | null; is_super_admin: boolean } | null;
};

export default async function OwnerTicketDetail({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenant } = await requireOwner();
  const svc = getServiceClient();

  const { data: ticket } = await svc
    .from("support_tickets")
    .select("id, subject, status, created_at, tenant_id")
    .eq("id", id)
    .eq("tenant_id", tenant.id)
    .maybeSingle<Ticket>();
  if (!ticket) notFound();

  const { data: messages } = await svc
    .from("ticket_messages")
    .select("id, body, created_at, author_user_id, profiles:author_user_id(display_name, email, is_super_admin)")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });
  const msgs = (messages ?? []) as unknown as Message[];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3 text-sm text-white/50">
        <Link href="/tickets" className="hover:text-white">← Tickets</Link>
        <span>/</span>
        <span className="text-white">{ticket.subject}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{ticket.subject}</h1>
        <p className="text-xs text-white/40 mt-1">
          Abierto el {new Date(ticket.created_at).toLocaleString('es-AR')} · Estado: {ticket.status}
        </p>
      </div>

      <ul className="space-y-3">
        {msgs.map((m) => {
          const isFounder = m.profiles?.is_super_admin;
          return (
            <li key={m.id} className={`rounded-xl border p-4 ${isFounder ? 'border-fuchsia-500/30 bg-fuchsia-500/5' : 'border-white/10 bg-white/[0.02]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {isFounder ? '🛟 Equipo Curplat' : (m.profiles?.display_name ?? m.profiles?.email ?? 'Vos')}
                </span>
                <span className="text-xs text-white/40">{new Date(m.created_at).toLocaleString('es-AR')}</span>
              </div>
              <p className="text-sm whitespace-pre-line text-white/90">{m.body}</p>
            </li>
          );
        })}
      </ul>

      <ReplyForm ticketId={ticket.id} status={ticket.status} />
    </div>
  );
}
