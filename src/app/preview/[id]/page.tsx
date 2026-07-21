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
  searchParams: Promise<{ embedded?: string; primary?: string; gradient?: string }>;
}) {
  const { id } = await params;
  const { embedded, primary: primaryOverride, gradient: gradientOverride } = await searchParams;
  const t = SITE_TEMPLATES.find((x) => x.id === id);
  if (!t) notFound();

  const cfg = t.config;
  // ?primary=%23f97316 → sobrescribe el color del template. El onboarding
  // manda el color que el user picó para que el preview se pinte en vivo.
  // Validamos que sea un hex válido antes de aceptar (evita XSS via style).
  const HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
  const primary = primaryOverride && HEX_RE.test(primaryOverride)
    ? primaryOverride
    : t.suggestedPrimary;
  // ?gradient=linear-gradient(...) — el onboarding también manda el
  // gradient CSS si el owner eligió uno. Se aplica como CSS var
  // --brand-bg en el wrapper del preview, así los CTA con
  // `var(--brand-bg, primary)` lo agarran automáticamente.
  // Validación: solo aceptar linear-/radial-/conic-gradient para
  // evitar CSS injection via url() u otros valores.
  const GRAD_RE = /^(linear|radial|conic)-gradient\([^)]*(?:\([^)]*\)[^)]*)*\)$/i;
  const brandGradient = gradientOverride && GRAD_RE.test(gradientOverride)
    ? gradientOverride
    : null;
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
      brandGradient={brandGradient}
      config={cfg}
      content={content}
      embedded={isEmbedded}
    />
  );
}
