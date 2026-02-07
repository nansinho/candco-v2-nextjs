"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  GraduationCap,
  Building2,
  Users,
  UserCheck,
  Landmark,
  BookOpen,
  ClipboardList,
  Calendar,
  CalendarDays,
  CheckSquare,
  BarChart3,
  Target,
  FileText,
  Receipt,
  FileX,
  Download,
  LifeBuoy,
  DoorOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { NAV_SECTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./sidebar-context";
import { OrgSelector } from "./OrgSelector";

interface Organisation {
  id: string;
  nom: string;
}

interface SidebarProps {
  currentOrganisation?: Organisation | null;
  organisations?: Organisation[];
  isSuperAdmin?: boolean;
  hasMultiOrg?: boolean;
}

const iconMap: Record<string, React.ElementType> = {
  GraduationCap,
  Building2,
  Users,
  UserCheck,
  Landmark,
  BookOpen,
  ClipboardList,
  Calendar,
  CalendarDays,
  CheckSquare,
  BarChart3,
  Target,
  FileText,
  Receipt,
  FileX,
  Download,
  LifeBuoy,
  DoorOpen,
  Settings,
};

export function Sidebar({
  currentOrganisation = null,
  organisations = [],
  isSuperAdmin = false,
  hasMultiOrg = false,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // Close mobile sidebar on navigation
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-3">
        {!collapsed ? (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[9px] font-bold leading-none text-white">
              C&CO
            </div>
            <span className="text-[13px] font-semibold tracking-tight">C&CO Formation</span>
          </Link>
        ) : (
          <Link href="/" className="mx-auto">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-[9px] font-bold leading-none text-white">
              C&CO
            </div>
          </Link>
        )}

        {/* Close button on mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors lg:hidden cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Org Selector — visible only for super-admins or multi-org users */}
      {hasMultiOrg && (
        <OrgSelector
          currentOrganisation={currentOrganisation}
          organisations={organisations}
          isSuperAdmin={isSuperAdmin}
          collapsed={collapsed}
        />
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={section.title} className={cn(idx > 0 && "mt-3")}>
            {!collapsed && (
              <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-sidebar-muted/50">
                {section.title}
              </p>
            )}
            {collapsed && idx > 0 && (
              <div className="mx-4 mb-2 border-t border-sidebar-border" />
            )}
            <ul className="space-y-0.5 px-2">
              {section.items.map((item) => {
                const Icon = iconMap[item.icon] ?? Settings;
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-all duration-150",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground/80"
                      )}
                      title={collapsed ? item.label : undefined}
                    >
                      {isActive && (
                        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                      )}
                      <Icon className={cn(
                        "h-4 w-4 shrink-0 transition-colors",
                        isActive ? "text-primary" : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/60"
                      )} />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-sidebar-border p-2 space-y-0.5">
        <button
          type="button"
          onClick={toggleTheme}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all cursor-pointer",
            collapsed && "justify-center"
          )}
          title={theme === "dark" ? "Mode clair" : "Mode sombre"}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4 shrink-0" />
          ) : (
            <Moon className="h-4 w-4 shrink-0" />
          )}
          {!collapsed && <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] text-sidebar-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-all cursor-pointer",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Déconnexion</span>}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="hidden w-full items-center justify-center rounded-lg p-1.5 text-sidebar-foreground/20 hover:bg-sidebar-accent hover:text-sidebar-foreground/50 transition-all cursor-pointer lg:flex"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
          collapsed ? "w-16" : "w-[240px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
