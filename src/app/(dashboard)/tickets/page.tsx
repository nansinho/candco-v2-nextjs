"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LifeBuoy,
  Circle,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getTickets,
  archiveTickets,
  type TicketRow,
  type TicketFilters,
} from "@/actions/tickets";
import { formatDate } from "@/lib/utils";

// ─── Badge configs ───────────────────────────────────────

const STATUT_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  ouvert: { label: "Ouvert", variant: "warning", icon: Circle },
  en_cours: { label: "En cours", variant: "info", icon: Clock },
  en_attente: { label: "En attente", variant: "outline", icon: AlertTriangle },
  resolu: { label: "Résolu", variant: "success", icon: CheckCircle2 },
  ferme: { label: "Fermé", variant: "secondary", icon: XCircle },
};

const PRIORITE_CONFIG: Record<string, { label: string; variant: string }> = {
  urgente: { label: "Urgente", variant: "destructive" },
  haute: { label: "Haute", variant: "warning" },
  normale: { label: "Normale", variant: "info" },
  basse: { label: "Basse", variant: "secondary" },
};

const CATEGORIE_LABELS: Record<string, string> = {
  bug: "Bug",
  demande: "Demande",
  question: "Question",
  amelioration: "Amélioration",
  autre: "Autre",
};

const AUTEUR_TYPE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "Utilisateur",
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact client",
};

// ─── Columns ─────────────────────────────────────────────

const columns: Column<TicketRow>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.numero_affichage}
      </span>
    ),
  },
  {
    key: "titre",
    label: "Titre",
    sortable: true,
    filterType: "text",
    minWidth: 280,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <LifeBuoy className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <span className="font-medium truncate block">{item.titre}</span>
          {item.message_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {item.message_count} message{item.message_count > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "statut",
    label: "Statut",
    sortable: true,
    minWidth: 130,
    render: (item) => {
      const config = STATUT_CONFIG[item.statut];
      if (!config) return item.statut;
      const Icon = config.icon;
      return (
        <Badge variant={config.variant as "default"} className="gap-1">
          <Icon className="h-3 w-3" />
          {config.label}
        </Badge>
      );
    },
  },
  {
    key: "priorite",
    label: "Priorité",
    sortable: true,
    minWidth: 110,
    render: (item) => {
      const config = PRIORITE_CONFIG[item.priorite];
      if (!config) return item.priorite;
      return (
        <Badge variant={config.variant as "default"}>
          {config.label}
        </Badge>
      );
    },
  },
  {
    key: "categorie",
    label: "Catégorie",
    sortable: true,
    minWidth: 120,
    render: (item) =>
      item.categorie ? (
        <span className="text-sm">{CATEGORIE_LABELS[item.categorie] || item.categorie}</span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "entreprise",
    label: "Entreprise",
    minWidth: 160,
    render: (item) =>
      item.entreprise?.nom ? (
        <span className="text-sm">{item.entreprise.nom}</span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "auteur_nom",
    label: "Auteur",
    sortable: true,
    minWidth: 150,
    render: (item) => (
      <div>
        <span className="text-sm">{item.auteur_nom || "Inconnu"}</span>
        <span className="ml-1 text-xs text-muted-foreground">
          ({AUTEUR_TYPE_LABELS[item.auteur_type] || item.auteur_type})
        </span>
      </div>
    ),
  },
  {
    key: "assignee",
    label: "Assigné à",
    minWidth: 140,
    render: (item) =>
      item.assignee ? (
        <span className="text-sm">{item.assignee.prenom} {item.assignee.nom}</span>
      ) : (
        <span className="text-muted-foreground/40 text-sm">Non assigné</span>
      ),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <span className="text-muted-foreground text-sm">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Tabs for filtering ──────────────────────────────────

type TabKey = "tous" | "mes_tickets" | "non_assignes" | "resolus";

const TABS: { key: TabKey; label: string }[] = [
  { key: "tous", label: "Tous" },
  { key: "mes_tickets", label: "Mes tickets" },
  { key: "non_assignes", label: "Non assignés" },
  { key: "resolus", label: "Résolus" },
];

// ─── Page ────────────────────────────────────────────────

export default function TicketsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<TicketRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = React.useState<TabKey>("tous");

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Build filters based on active tab
  const getFilters = React.useCallback((): TicketFilters => {
    switch (activeTab) {
      case "mes_tickets":
        return { my_tickets: true };
      case "non_assignes":
        return {};
      case "resolus":
        return { statut: "resolu" };
      default:
        return {};
    }
  }, [activeTab]);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const filters = getFilters();
      const result = await getTickets(page, debouncedSearch, sortBy, sortDir, filters);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortDir, getFilters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border/60">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable
        title="Tickets"
        tableId="tickets"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => router.push("/tickets/new")}
        addLabel="Nouveau ticket"
        onRowClick={(item) => router.push(`/tickets/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        onArchive={async (ids) => {
          const result = await archiveTickets(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} ticket(s) archivé(s).`, variant: "success" });
        }}
      />
    </div>
  );
}
