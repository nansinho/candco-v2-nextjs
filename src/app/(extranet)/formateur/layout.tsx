import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ExtranetFormateurShell } from "./shell";

export default function ExtranetFormateurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SidebarProvider>
        <ExtranetFormateurShell>{children}</ExtranetFormateurShell>
      </SidebarProvider>
    </ToastProvider>
  );
}
