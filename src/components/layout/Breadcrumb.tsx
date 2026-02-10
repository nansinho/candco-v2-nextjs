"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { useBreadcrumbOverrides } from "./breadcrumb-context";

const labelMap: Record<string, string> = {
  apprenants: "Apprenants",
  entreprises: "Entreprises",
  "contacts-clients": "Contacts clients",
  formateurs: "Formateurs",
  financeurs: "Financeurs",
  produits: "Catalogue de formation",
  sessions: "Sessions",
  planning: "Planning",
  questionnaires: "Questionnaires",
  devis: "Devis",
  factures: "Factures",
  avoirs: "Avoirs",
  opportunites: "Opportunités",
  taches: "Tâches",
  parametres: "Paramètres",
  indicateurs: "Indicateurs",
  tickets: "Tickets",
  salles: "Salles",
  admin: "Admin Plateforme",
  organisations: "Organisations",
  utilisateurs: "Utilisateurs",
  activite: "Activité",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Breadcrumb() {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverrides();
  const segments = pathname.split("/").filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
      </Link>

      {segments.map((segment, index) => {
        const href = "/" + segments.slice(0, index + 1).join("/");
        const isLast = index === segments.length - 1;

        // Priority: overrides > labelMap > UUID detection > raw segment
        let label: string;
        if (overrides[segment]) {
          label = overrides[segment];
        } else if (labelMap[segment]) {
          label = labelMap[segment];
        } else if (UUID_REGEX.test(segment)) {
          label = "...";
        } else {
          label = segment;
        }

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground truncate max-w-[200px]">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px]"
              >
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
