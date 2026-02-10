import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getAICredits } from "@/actions/parametres";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let aiCredits = null;
  try {
    user = await getCurrentUser();
    const creditsResult = await getAICredits();
    aiCredits = creditsResult.data;
  } catch (err) {
    console.error("[DashboardLayout] getCurrentUser failed:", err);
  }

  const userInitial = user?.prenom?.[0]?.toUpperCase() ?? user?.nom?.[0]?.toUpperCase() ?? "N";

  return (
    <ToastProvider>
      <SidebarProvider>
        <BreadcrumbProvider>
          <NavigationProgress />
          <div className="flex min-h-screen bg-background">
            <Sidebar
              currentOrganisation={user?.currentOrganisation ?? null}
              organisations={user?.organisations ?? []}
              isSuperAdmin={user?.is_super_admin ?? false}
              hasMultiOrg={user?.hasMultiOrg ?? false}
            />
            <div className="flex flex-1 flex-col lg:pl-[240px] transition-all duration-300 min-w-0">
              <Header
                aiCredits={aiCredits}
                userInitial={userInitial}
                userName={user ? `${user.prenom ?? ""} ${user.nom ?? ""}`.trim() || undefined : undefined}
                userEmail={user?.email}
              />
              <main className="flex-1 mt-14 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-x-hidden">
                {children}
              </main>
            </div>
          </div>
        </BreadcrumbProvider>
      </SidebarProvider>
    </ToastProvider>
  );
}
