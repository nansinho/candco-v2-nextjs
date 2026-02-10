import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { AdminShell } from "./shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !user.is_super_admin) {
    redirect("/");
  }

  return (
    <ToastProvider>
      <SidebarProvider>
        <BreadcrumbProvider>
          <NavigationProgress />
          <AdminShell>{children}</AdminShell>
        </BreadcrumbProvider>
      </SidebarProvider>
    </ToastProvider>
  );
}
