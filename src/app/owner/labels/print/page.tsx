import { LabelsPrintView } from '@/components/owner/products/LabelsPrintView';

export const dynamic = 'force-dynamic';

/**
 * URL de imprimir. El proxy rewritea /labels/print → /owner/labels/print
 * cuando el owner está en app.<root>. Ver src/proxy.ts.
 * La página no muestra el chrome del owner porque el LabelsPrintView
 * usa un wrapper fixed + @media print que oculta todo lo demás.
 */
export default async function LabelsPrintPage({
  searchParams
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  return <LabelsPrintView encoded={sp.d ?? ''} />;
}
