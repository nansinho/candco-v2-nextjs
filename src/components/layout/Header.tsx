"use client";

import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "./Breadcrumb";
import { useSidebar } from "./sidebar-context";

export function Header() {
  const { setMobileOpen } = useSidebar();

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
        <div className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-primary">
          N
        </div>
      </div>
    </header>
  );
}
