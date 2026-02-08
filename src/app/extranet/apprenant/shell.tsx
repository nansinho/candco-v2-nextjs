"use client";

import { SidebarExtranet } from "@/components/layout/SidebarExtranet";
import { Header } from "@/components/layout/Header";
import { EXTRANET_APPRENANT_NAV } from "@/lib/constants";

export function ExtranetApprenantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <SidebarExtranet
        navItems={EXTRANET_APPRENANT_NAV}
        title="Espace Apprenant"
        subtitle="C&CO Formation"
        accentColor="bg-blue-600"
      />
      <div className="flex flex-1 flex-col lg:pl-[240px] transition-all duration-300 min-w-0">
        <Header />
        <main className="flex-1 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
