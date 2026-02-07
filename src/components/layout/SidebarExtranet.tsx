"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Receipt,
  MessageSquare,
  UserCog,
  PenTool,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "./sidebar-context";

const iconMap: Record<string, React.ElementType> = {
  BarChart3,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Receipt,
  MessageSquare,
  UserCog,
  PenTool,
  ClipboardList,
};

interface SidebarExtranetProps {
  navItems: ReadonlyArray<{
    readonly label: string;
    readonly href: string;
    readonly icon: string;
  }>;
  title: string;
  subtitle: string;
  accentColor?: string;
}

export function SidebarExtranet({ navItems, title, subtitle, accentColor = "bg-primary" }: SidebarExtranetProps) {
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

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo / Title */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold leading-none text-white", accentColor)}>
              C&CO
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight">{title}</p>
              <p className="truncate text-[10px] text-sidebar-muted/60">{subtitle}</p>
            </div>
          </div>
        ) : (
          <div className="mx-auto">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-bold leading-none text-white", accentColor)}>
              C&CO
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors lg:hidden cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = iconMap[item.icon] ?? BarChart3;
            const isActive =
              pathname === item.href ||
              (item.href !== navItems[0].href && pathname.startsWith(item.href + "/"));

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
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-primary"
                        : "text-sidebar-foreground/35 group-hover:text-sidebar-foreground/60"
                    )}
                  />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
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
          {!collapsed && <span>Deconnexion</span>}
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
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex",
          collapsed ? "w-16" : "w-[240px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile */}
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
