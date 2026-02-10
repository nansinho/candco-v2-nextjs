"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Menu, Search, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Breadcrumb } from "./Breadcrumb";
import { useSidebar } from "./sidebar-context";
import { createClient } from "@/lib/supabase/client";

interface HeaderProps {
  aiCredits?: { monthly_limit: number; used: number; remaining: number } | null;
  userInitial?: string;
  userName?: string;
  userEmail?: string;
}

export function Header({ aiCredits, userInitial = "N", userName, userEmail }: HeaderProps) {
  const { setMobileOpen } = useSidebar();
  const router = useRouter();

  const remaining = aiCredits?.remaining ?? 0;
  const limit = aiCredits?.monthly_limit ?? 0;
  const pct = limit > 0 ? (remaining / limit) * 100 : 0;

  // Color: green >70%, orange 30-70%, red <30%
  const creditColor =
    pct > 70
      ? "text-emerald-400"
      : pct > 30
        ? "text-orange-400"
        : "text-red-400";

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="fixed top-0 right-0 left-0 lg:left-[240px] z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-2">
        {/* Hamburger menu - mobile only */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground/60 hover:text-foreground lg:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Breadcrumb />
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground/60 hover:text-foreground">
          <Search className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground/60 hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
        </Button>

        {/* AI Credits indicator */}
        {aiCredits && (
          <Link
            href="/parametres?tab=ia"
            className="group flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-muted/50 transition-colors"
            title={`${remaining} crédits IA restants sur ${limit} ce mois-ci`}
          >
            <Sparkles className={`h-3.5 w-3.5 ${creditColor}`} />
            <span className={`text-xs font-medium tabular-nums ${creditColor}`}>
              {remaining}
            </span>
            <span className="text-xs text-muted-foreground/60 hidden sm:inline">
              /{limit}
            </span>
          </Link>
        )}

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary hover:bg-primary/25 transition-colors cursor-pointer"
            >
              {userInitial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName || "Utilisateur"}</p>
                {userEmail && (
                  <p className="text-xs leading-none text-muted-foreground">{userEmail}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/parametres")}>
              <Settings className="mr-2 h-4 w-4" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} destructive>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
