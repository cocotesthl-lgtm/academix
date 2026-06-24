import { requireSuperAdmin } from "@/lib/auth/guards";
import { SignoutButton } from "@/components/auth/SignoutButton";
import { SaveStatusBar } from "@/components/owner/SaveStatusBar";
import { GlobalSaveListener } from "@/components/owner/GlobalSaveListener";
import { FounderNav } from "@/components/founder/FounderNav";

export const dynamic = "force-dynamic";

export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();
  return (
    <div data-ui-theme="dark" className="min-h-screen flex bg-[#0a0a0a] text-white">
      <aside className="w-60 border-r border-white/10 p-4 flex flex-col">
        <h2 className="font-bold text-lg">Founder</h2>
        <div className="mt-3 mb-3 min-h-[2px]">
          <SaveStatusBar />
        </div>
        <GlobalSaveListener />
        <FounderNav />
        <div className="mt-auto pt-4 border-t border-white/10">
          <SignoutButton />
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
