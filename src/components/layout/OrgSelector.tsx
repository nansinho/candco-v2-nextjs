"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { switchOrganisation } from "@/lib/auth-helpers";

interface Organisation {
  id: string;
  nom: string;
}

interface OrgSelectorProps {
  currentOrganisation: Organisation | null;
  organisations: Organisation[];
  isSuperAdmin: boolean;
  collapsed: boolean;
}

export function OrgSelector({
  currentOrganisation,
  organisations,
  isSuperAdmin,
  collapsed,
}: OrgSelectorProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSwitch(orgId: string) {
    if (orgId === currentOrganisation?.id) {
      setOpen(false);
      return;
    }
    setOpen(false);
    const result = await switchOrganisation(orgId);
    if (!("error" in result)) {
      window.location.href = "/";
    }
  }

  async function handleAdminPlatform() {
    setOpen(false);
    router.push("/admin");
  }

  if (collapsed) {
    return (
      <div className="flex justify-center px-2 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative px-3 py-3">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border border-border/50 px-3 py-2",
          "bg-card/50 hover:bg-card transition-colors text-left",
          "text-sm"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate flex-1 font-medium">
          {currentOrganisation?.nom || "Organisation"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
          <div className="max-h-64 overflow-y-auto py-1">
            {organisations.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors",
                  org.id === currentOrganisation?.id && "bg-accent/30 font-medium"
                )}
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{org.nom}</span>
              </button>
            ))}

            {isSuperAdmin && (
              <>
                <div className="mx-3 my-1 border-t border-border" />
                <button
                  onClick={handleAdminPlatform}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent/50 transition-colors text-primary"
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  <span>Admin plateforme</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
