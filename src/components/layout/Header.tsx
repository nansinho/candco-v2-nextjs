"use client";

import Link from "next/link";
import { Bell, Menu, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "./Breadcrumb";
import { useSidebar } from "./sidebar-context";

interface HeaderProps {
  aiCredits?: { monthly_limit: number; used: number; remaining: number } | null;
  userInitial?: string;
}

export function Header({ aiCredits, userInitial = "N" }: HeaderProps) {
  const { setMobileOpen } = useSidebar();

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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
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
            <span className="text-[10px] text-muted-foreground/40 hidden sm:inline">
              /{limit}
            </span>
          </Link>
        )}

        <div className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          {userInitial}
        </div>
      </div>
    </header>
  );
}
