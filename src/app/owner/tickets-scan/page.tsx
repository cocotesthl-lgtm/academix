import { requireOwner } from '@/lib/auth/guards';
import { TicketScanner } from '@/components/owner/tickets/Scanner';

export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  await requireOwner();
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Validar tickets</h1>
        <p className="text-sm text-white/55 mt-1">
          Escaneá los QR con la pistola, la cámara o tipeá el N° de orden.
        </p>
      </div>
      <TicketScanner />
    </div>
  );
}
