import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('candco-theme');if(t==='light'||t==='dark')document.documentElement.className=t;else t='dark';var r=localStorage.getItem('candco-theme-colors');if(r){var c=JSON.parse(r),p=t==='light'?c.light:c.dark;if(p){var d=document.documentElement,m={background:['--color-background'],foreground:['--color-foreground','--color-card-foreground','--color-popover-foreground','--color-accent-foreground','--color-secondary-foreground','--color-sidebar-foreground','--color-header-foreground'],card:['--color-card','--color-popover'],primary:['--color-primary','--color-ring'],sidebar:['--color-sidebar'],header:['--color-header'],border:['--color-border','--color-input'],muted:['--color-muted','--color-secondary'],accent:['--color-accent']};for(var k in m)if(p[k])m[k].forEach(function(v){d.style.setProperty(v,p[k])});if(t==='light'&&p.sidebar&&p.background){document.body.style.background='linear-gradient(135deg,'+p.sidebar+' 0%,'+p.background+' 50%,'+p.background+' 100%)';document.body.style.backgroundAttachment='fixed'}}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
