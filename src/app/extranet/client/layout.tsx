import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ExtranetClientShell } from "./shell";

export default function ExtranetClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SidebarProvider>
        <ExtranetClientShell>{children}</ExtranetClientShell>
      </SidebarProvider>
    </ToastProvider>
  );
}
