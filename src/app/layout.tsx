import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "C&CO Formation",
  description: "Logiciel de gestion d'organisme de formation",
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
            __html: [
              // Theme: read from localStorage before paint
              `(function(){try{var t=localStorage.getItem('candco-theme');if(t==='light'||t==='dark')document.documentElement.className=t;}catch(e){}})();`,
              // Polyfill crypto.randomUUID for non-secure contexts (HTTP)
              `if(typeof crypto!=='undefined'&&!crypto.randomUUID){crypto.randomUUID=function(){return([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,function(c){return(c^(crypto.getRandomValues(new Uint8Array(1))[0]&(15>>c/4))).toString(16)})}}`,
            ].join('\n'),
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
