import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SITE_TEMPLATES } from '@/lib/site/templates/catalog';
import { DEMO_CONTENT, contentKey } from '@/lib/site/templates/demo-content';
import { PreviewInteractive } from '@/components/preview/PreviewInteractive';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) return { title: 'Preview no encontrada' };
  return {
    title: `Demo · ${t.name}`,
    description: t.shortDesc
  };
}

export default async function TemplatePreviewPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embedded?: string }>;
}) {
  const { id } = await params;
  const { embedded } = await searchParams;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) notFound();

  const cfg = t.config;
  const primary = t.suggestedPrimary;
  const key = contentKey(t.id);
  const content = key ? DEMO_CONTENT[key] : null;

  // ?embedded=1 → preview embebido en el iframe del onboarding.
  // Ocultamos la barra superior y el CTA "Usar este template →" que
  // llevan a /signup (el user ya está en el onboarding, no tiene sentido
  // sacarlo de nuevo). El template se elige desde la columna izquierda.
  const isEmbedded = embedded === '1' || embedded === 'true';

  return (
    <PreviewInteractive
      templateId={t.id}
      templateName={t.name}
      templateEmoji={t.emoji}
      primary={primary}
      config={cfg}
      content={content}
      embedded={isEmbedded}
    />
  );
}
