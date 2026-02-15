import { ToastProvider } from "@/components/ui/toast";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { ThemeColorsHydrator } from "@/components/theme-colors-hydrator";
import { getThemeSettings } from "@/actions/parametres";
import { ExtranetApprenantShell } from "./shell";

export default async function ExtranetApprenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeColorsJson: string | null = null;
  try {
    const themeResult = await getThemeSettings();
    if (themeResult.data) {
      themeColorsJson = JSON.stringify(themeResult.data);
    }
  } catch {
    // Ignore theme loading errors
  }

  return (
    <ToastProvider>
      <ThemeColorsHydrator themeColorsJson={themeColorsJson} />
      <SidebarProvider>
        <ExtranetApprenantShell>{children}</ExtranetApprenantShell>
      </SidebarProvider>
    </ToastProvider>
  );
}
