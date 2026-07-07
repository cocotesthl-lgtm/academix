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
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) notFound();

  const cfg = t.config;
  const primary = t.suggestedPrimary;
  const key = contentKey(t.id);
  const content = key ? DEMO_CONTENT[key] : null;

  return (
    <PreviewInteractive
      templateId={t.id}
      templateName={t.name}
      templateEmoji={t.emoji}
      primary={primary}
      config={cfg}
      content={content}
    />
  );
}
