import { requireOwner } from '@/lib/auth/guards';
import { TicketScanner } from '@/components/owner/tickets/Scanner';
import { PageHeader, HeaderSecondary } from '@/components/owner/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ScanPage() {
  await requireOwner();
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Validar entradas"
        description="Escaneá QR con pistola o cámara, o tipeá el N° de orden para validar manualmente."
        actions={<HeaderSecondary href="/eventos/asistencia">Ver asistencia</HeaderSecondary>}
      />
      <TicketScanner />
    </div>
  );
}
