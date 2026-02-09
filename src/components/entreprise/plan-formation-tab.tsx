"use client";

import * as React from "react";
import { BesoinsFormationTab } from "@/components/entreprise/besoins-formation-tab";
import { RepartitionBudgetaireTab } from "@/components/entreprise/repartition-budgetaire-tab";
import { VueConsolideeAnnuelleTab } from "@/components/entreprise/vue-consolidee-annuelle-tab";
import { VueConsolideeAgenceTab } from "@/components/entreprise/vue-consolidee-agence-tab";

// ─── Types ──────────────────────────────────────────────

interface AgenceOption {
  id: string;
  nom: string;
}

type SubTab = "plan_annuel" | "ponctuelles" | "consolidee_annuelle" | "consolidee_agence" | "repartition";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "plan_annuel", label: "Plan annuel" },
  { key: "ponctuelles", label: "Formations ponctuelles" },
  { key: "consolidee_annuelle", label: "Vue consolidée annuelle" },
  { key: "consolidee_agence", label: "Vue consolidée par agence" },
  { key: "repartition", label: "Répartition budgétaire" },
];

// ─── Component ──────────────────────────────────────────

export function PlanFormationTab({
  entrepriseId,
  agences,
}: {
  entrepriseId: string;
  agences: AgenceOption[];
}) {
  const [subTab, setSubTab] = React.useState<SubTab>("plan_annuel");

  return (
    <div className="space-y-4">
      {/* Sub-tab pills */}
      <div className="flex items-center gap-1 rounded-lg bg-muted/30 p-1 w-fit flex-wrap">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              subTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === "plan_annuel" && (
        <BesoinsFormationTab
          entrepriseId={entrepriseId}
          agences={agences}
          typeBesoin="plan"
        />
      )}
      {subTab === "ponctuelles" && (
        <BesoinsFormationTab
          entrepriseId={entrepriseId}
          agences={agences}
          typeBesoin="ponctuel"
        />
      )}
      {subTab === "consolidee_annuelle" && (
        <VueConsolideeAnnuelleTab entrepriseId={entrepriseId} />
      )}
      {subTab === "consolidee_agence" && (
        <VueConsolideeAgenceTab entrepriseId={entrepriseId} />
      )}
      {subTab === "repartition" && (
        <RepartitionBudgetaireTab
          entrepriseId={entrepriseId}
          agences={agences}
        />
      )}
    </div>
  );
}
