import type { Metadata } from "next";
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
    <html lang="fr" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
