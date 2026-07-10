import { redirect } from "next/navigation";
import { OnboardingWithPreview } from "@/components/auth/OnboardingWithPreview";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function subdomainUrl(sub: 'admin' | 'app', path: string): string {
  const appUrl = new URL(env.appUrl);
  const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
  const host = isLocal
    ? `${sub}.localhost${appUrl.port ? ":" + appUrl.port : ""}`
    : `${sub}.${env.rootDomain}`;
  return `${appUrl.protocol}//${host}${path}`;
}

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  const svc = getServiceClient();

  // Super admins go to the founder panel, not onboarding.
  const { data: profile } = await svc
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .maybeSingle<{ is_super_admin: boolean }>();
  if (profile?.is_super_admin) {
    redirect(subdomainUrl('admin', '/dashboard'));
  }

  // Un user puede tener MÚLTIPLES tenants como owner (workspace switcher).
  // Si aterrizó acá SIN el flag ?new=1 y ya tiene tenants → asumimos que se
  // equivocó de ruta y lo mandamos a su dashboard. Si vino con ?new=1 desde
  // el WorkspaceSwitcher ("+ Crear nuevo sitio"), le dejamos crear otro.
  const { new: isNew } = await searchParams;
  const wantsNew = isNew === '1' || isNew === 'true';

  if (!wantsNew) {
    const { data: existing } = await svc
      .from("memberships")
      .select("tenant_id, tenants ( slug )")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle<{ tenant_id: string; tenants: { slug: string } | null }>();

    if (existing) {
      redirect(subdomainUrl('app', '/dashboard'));
    }
  }

  return (
    <main className="min-h-screen bg-[#fafafa] text-neutral-900 p-6">
      {/* Layout 2 columnas en desktop (form + preview iframe a la derecha).
          En mobile queda 1 columna centrada. Header + branding se renderean
          dentro del wrapper client para mantener el layout coherente. */}
      <OnboardingWithPreview rootDomain={env.rootDomain} />
    </main>
  );
}
