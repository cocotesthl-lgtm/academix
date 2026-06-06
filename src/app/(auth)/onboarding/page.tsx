import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
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

export default async function OnboardingPage() {
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

  // If user already owns a tenant, send them straight to the owner dashboard.
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

  return (
    <main data-ui-theme="dark" className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold tracking-tight">Curplat</Link>
          <h1 className="mt-6 text-3xl font-bold">Configurá tu academia</h1>
          <p className="mt-2 text-white/60">Estos datos los podés cambiar después.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <OnboardingForm rootDomain={env.rootDomain} />
        </div>
      </div>
    </main>
  );
}
