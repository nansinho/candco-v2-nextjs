"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const labelMap: Record<string, string> = {
  apprenants: "Apprenants",
  entreprises: "Entreprises",
  "contacts-clients": "Contacts clients",
  formateurs: "Formateurs",
  financeurs: "Financeurs",
  produits: "Produits de formation",
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
};

export function Breadcrumb() {
  const pathname = usePathname();
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
        const label = labelMap[segment] ?? segment;

        return (
          <span key={href} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            {isLast ? (
              <span className="font-medium text-foreground">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-muted-foreground hover:text-foreground transition-colors"
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
