import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  // If user already owns a tenant, send them straight to the dashboard.
  const svc = getServiceClient();
  const { data: existing } = await svc
    .from("memberships")
    .select("tenant_id, tenants ( slug )")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ tenant_id: string; tenants: { slug: string } | null }>();

  if (existing) {
    const appUrl = new URL(env.appUrl);
    const isLocal = appUrl.hostname === "localhost" || appUrl.hostname.endsWith(".localhost");
    const ownerHost = isLocal ? `app.localhost${appUrl.port ? ":" + appUrl.port : ""}` : `app.${env.rootDomain}`;
    redirect(`${appUrl.protocol}//${ownerHost}/dashboard`);
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
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
