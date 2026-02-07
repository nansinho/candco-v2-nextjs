import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { getCurrentUser } from "@/lib/auth-helpers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <ToastProvider>
      <SidebarProvider>
        <BreadcrumbProvider>
          <div className="flex min-h-screen bg-background">
            <Sidebar
              currentOrganisation={user?.currentOrganisation ?? null}
              organisations={user?.organisations ?? []}
              isSuperAdmin={user?.is_super_admin ?? false}
              hasMultiOrg={user?.hasMultiOrg ?? false}
            />
            <div className="flex flex-1 flex-col lg:pl-[240px] transition-all duration-300 min-w-0">
              <Header />
              <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-hidden">
                {children}
              </main>
            </div>
          </div>
        </BreadcrumbProvider>
      </SidebarProvider>
    </ToastProvider>
  );
}
