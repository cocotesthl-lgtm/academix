import { NewTicketForm } from "@/components/tickets/NewTicketForm";

export const dynamic = "force-dynamic";

export default function NewTicketPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nuevo ticket</h1>
        <p className="text-white/60 text-sm mt-1">El equipo te responde por acá.</p>
      </div>
      <NewTicketForm />
    </div>
  );
}
