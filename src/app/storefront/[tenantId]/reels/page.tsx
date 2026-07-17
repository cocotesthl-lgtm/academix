import { notFound } from 'next/navigation';
import { getTenantById } from '@/lib/tenant/resolve';
import { fetchVideosForTenant } from '@/lib/demo-pool/queries';
import { ReelsPlayer } from '@/components/storefront/reels/ReelsPlayer';

export const dynamic = 'force-dynamic';

/**
 * Player fullscreen vertical de shorts (estilo TikTok / Reels / NYT
 * video). Trae todos los videos del tenant + pool visible y los
 * renderiza en un scroll-snap vertical con autoplay por visibilidad.
 *
 * Query param ?v=<slug> indica cuál mostrar primero (scrolls into view).
 * Si no se pasa, arranca desde el primero.
 */
export default async function ReelsPage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const { tenantId } = await params;
  const { v: initialSlug = null } = await searchParams;
  const tenant = await getTenantById(tenantId);
  if (!tenant) notFound();

  const videos = await fetchVideosForTenant(tenantId, { limit: 50 });
  if (videos.length === 0) notFound();

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <ReelsPlayer
        videos={videos.map((v) => ({
          slug: v.slug,
          title: v.title,
          description: v.description,
          youtube_id: v.youtube_id
        }))}
        initialSlug={initialSlug}
        tenantName={tenant.name}
      />
    </div>
  );
}
