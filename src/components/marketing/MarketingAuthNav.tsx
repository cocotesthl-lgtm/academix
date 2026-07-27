import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service";
import { SignoutButton } from "@/components/auth/SignoutButton";

type Variant = "light" | "dark";

/**
 * Header CTA para páginas de marketing públicas (/, /buscar, /affiliate, etc).
 * Si NO hay user → muestra "Iniciar sesión" + "Crear cuenta" (o equivalentes).
 * Si HAY user  → muestra avatar/email + link inteligente al panel correspondiente
 *   · owner de algún tenant → "Ir a mi panel" → /workspaces
 *   · afiliado sin sitio    → "Mi panel afiliado" → /workspaces (elige)
 *   · comprador (sin nada)  → "Mis compras" → /buscar
 *   + Cerrar sesión
 */
export async function MarketingAuthNav({
  variant = "dark",
  signupHref = "/signup",
  signupLabel = "Crear cuenta",
  loginLabel = "Iniciar sesión",
}: {
  variant?: Variant;
  signupHref?: string;
  signupLabel?: string;
  loginLabel?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (variant === "light") {
      return (
        <>
          <Link href="/buscar" className="text-sm text-neutral-700 hover:text-neutral-900 font-medium">
            {loginLabel}
          </Link>
          <Link
            href={signupHref}
            className="text-sm rounded-full bg-orange-500 text-white px-5 py-2 font-semibold hover:bg-orange-600 transition"
          >
            {signupLabel}
          </Link>
        </>
      );
    }
    return (
      <>
        <Link href="/login" className="text-sm text-white/80 hover:text-white">
          {loginLabel}
        </Link>
        <Link href={signupHref} className="text-sm rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90">
          {signupLabel}
        </Link>
      </>
    );
  }

  // Resolver panel al que redirigir según memberships
  let panelHref = "/onboarding";
  let panelLabel = "Crear mi sitio";
  try {
    const svc = getServiceClient();
    const { data: memberships } = await svc
      .from("memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(5);
    const rows = (memberships ?? []) as Array<{ role: string }>;
    if (rows.some((m) => m.role === "owner")) {
      panelHref = "/owner";
      panelLabel = "Mi panel";
    } else if (rows.some((m) => m.role === "affiliate")) {
      panelHref = "/buscar";
      panelLabel = "Mis sitios afiliado";
    } else if (rows.some((m) => m.role === "instructor" || m.role === "staff")) {
      panelHref = "/instructor";
      panelLabel = "Mi panel";
    } else if (rows.length > 0) {
      // enrolled u otros: marketplace
      panelHref = "/buscar";
      panelLabel = "Mis sitios";
    }
    // Si no tiene memberships: fallback ya está en "Crear mi sitio" → /onboarding
  } catch {
    /* keep defaults */
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "Mi cuenta";
  const initial = (displayName ?? "?").trim().slice(0, 1).toUpperCase();

  // Colores según variante
  const cls = variant === "light"
    ? {
        wrap: "flex items-center gap-2 rounded-full border border-neutral-200 bg-white pl-1 pr-2 py-1",
        avatar: "w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold shrink-0",
        name: "text-xs text-neutral-800 font-medium max-w-[140px] truncate",
        cta: "text-sm rounded-full bg-orange-500 text-white px-4 py-2 font-semibold hover:bg-orange-600 transition",
        signout: "text-xs text-neutral-500 hover:text-neutral-800 px-2",
      }
    : {
        wrap: "flex items-center gap-2 rounded-full border border-white/15 bg-white/5 pl-1 pr-2 py-1",
        avatar: "w-7 h-7 rounded-full bg-white/15 text-white flex items-center justify-center text-xs font-bold shrink-0",
        name: "text-xs text-white/85 font-medium max-w-[140px] truncate",
        cta: "text-sm rounded-md bg-white text-black px-4 py-2 font-medium hover:bg-white/90",
        signout: "text-xs text-white/45 hover:text-white/90 px-2",
      };

  return (
    <>
      <div className={cls.wrap} title={user.email ?? undefined}>
        <div className={cls.avatar} aria-hidden>{initial}</div>
        <span className={cls.name}>{displayName}</span>
      </div>
      <Link href={panelHref} className={cls.cta}>
        {panelLabel} →
      </Link>
      <SignoutButton className={cls.signout} redirectTo="/" />
    </>
  );
}
