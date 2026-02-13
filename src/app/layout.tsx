import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { getOrgThemePresets } from "@/lib/theme-server";
import { getThemePreset, getDefaultPreset } from "@/lib/themes";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  title: "C&CO Formation",
  description: "Logiciel de gestion d'organisme de formation",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "C&CO Formation",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { darkPresetId, lightPresetId } = await getOrgThemePresets();
  const darkPreset = getThemePreset(darkPresetId) ?? getDefaultPreset("dark");
  const lightPreset = getThemePreset(lightPresetId) ?? getDefaultPreset("light");

  // Embed only the 2 active presets for flash prevention
  const inlinePresets = JSON.stringify({
    dark: darkPreset.vars,
    light: lightPreset.vars,
  });

  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('candco-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.className=t;var p=${inlinePresets};var v=p[t];if(v){for(var k in v)document.documentElement.style.setProperty(k,v[k])}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          orgDarkPresetId={darkPresetId}
          orgLightPresetId={lightPresetId}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
