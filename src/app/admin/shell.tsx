"use client";

import { SidebarExtranet } from "@/components/layout/SidebarExtranet";
import { Header } from "@/components/layout/Header";
import { ADMIN_NAV } from "@/lib/constants";

const ADMIN_FOOTER_LINKS = [
  { label: "Retour au back-office", href: "/", icon: "ArrowLeft" },
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SidebarExtranet
        navItems={ADMIN_NAV}
        title="Admin Plateforme"
        subtitle="C&CO"
        accentColor="bg-red-600"
        footerLinks={ADMIN_FOOTER_LINKS}
      />
      <div className="flex flex-1 flex-col lg:pl-[240px] transition-all duration-300 min-w-0">
        <Header />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
