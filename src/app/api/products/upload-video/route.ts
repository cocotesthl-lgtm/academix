import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { requireOwner } from '@/lib/auth/guards';
import { getServiceClient } from '@/lib/supabase/service';
import { getTenantPlan } from '@/lib/plans/queries';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Cap total del sistema — el owner nunca sube más de esto por archivo.
const MAX_BYTES = 100 * 1024 * 1024;  // 100 MB
const ALLOWED_TYPES: Record<string, string> = {
  'video/mp4':       'mp4',
  'video/webm':      'webm',
  'video/quicktime': 'mov',
  'video/x-m4v':     'm4v'
};

/**
 * POST /api/products/upload-video
 * multipart/form-data: field 'file' con el video.
 *
 * Gating por plan: solo tenants con features.uploads_enabled=true pueden
 * subir. Los demás obtienen 402 con mensaje de upgrade — pueden seguir
 * pegando links de YouTube/Vimeo (URL-only) en la galería sin costo.
 *
 * Response OK: { url, size, kind } — el owner appendea `url` al textarea
 * de galería del producto.
 */
export async function POST(req: NextRequest) {
  const { tenant } = await requireOwner();

  // 1. Validar plan del tenant
  const tenantPlan = await getTenantPlan(tenant.id);
  const uploadsEnabled = tenantPlan.plan?.features?.uploads_enabled === true;
  if (!uploadsEnabled) {
    return NextResponse.json({
      error: 'plan_required',
      message: 'Tu plan actual no incluye subir videos. Podés pegar links de YouTube/Vimeo en la galería sin costo, o hacer upgrade para subir MP4 propios.',
      current_plan: tenantPlan.plan?.name ?? null
    }, { status: 402 });
  }

  // 2. Parsear multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_multipart' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400 });
  }

  // 3. Validaciones
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json({
      error: 'unsupported_type',
      message: `Formato no soportado (${file.type}). Aceptamos mp4, webm, mov o m4v.`
    }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({
      error: 'too_large',
      message: `El archivo supera el máximo de ${MAX_BYTES / 1024 / 1024} MB.`
    }, { status: 413 });
  }

  // 4. Upload a Supabase Storage
  const svc = getServiceClient();
  const path = `${tenant.id}/${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await svc.storage
    .from('product-videos')
    .upload(path, bytes, {
      contentType: file.type,
      cacheControl: '31536000',  // 1 año — el path es único
      upsert: false
    });
  if (upErr) {
    console.error('[upload-video]', upErr);
    return NextResponse.json({
      error: 'upload_failed',
      message: upErr.message ?? 'Falló el upload al storage'
    }, { status: 500 });
  }

  // 5. URL pública (bucket es public)
  const { data: pub } = svc.storage.from('product-videos').getPublicUrl(path);

  return NextResponse.json({
    url: pub.publicUrl,
    size: file.size,
    kind: 'video'
  });
}
