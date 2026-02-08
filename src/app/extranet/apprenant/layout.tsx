import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ExtranetApprenantShell } from "./shell";

export default function ExtranetApprenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SidebarProvider>
        <ExtranetApprenantShell>{children}</ExtranetApprenantShell>
      </SidebarProvider>
    </ToastProvider>
  );
}
