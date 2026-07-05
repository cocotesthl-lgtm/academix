import { requireOwner } from '@/lib/auth/guards';
import { PageHeader } from '@/components/owner/PageHeader';
import { InventoryScanner } from '@/components/owner/products/InventoryScanner';

export const dynamic = 'force-dynamic';

export default async function InventoryScanPage() {
  const { tenant } = await requireOwner();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Escaneo de inventario"
        description="Escaneá códigos de barra (EAN, UPC, Code128) o QR para sumar o restar stock rápido. Ideal para recibir mercadería o hacer un conteo."
      />
      <InventoryScanner tenantId={tenant.id} />
    </div>
  );
}
