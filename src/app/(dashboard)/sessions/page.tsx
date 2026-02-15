"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, Loader2 } from "lucide-react";
import { DataTable, type Column, type ActiveFilter } from "@/components/data-table/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getSessions,
  createSession,
  archiveSession,
  unarchiveSession,
  deleteSessions,
  type CreateSessionInput,
} from "@/actions/sessions";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

// ─── Types ───────────────────────────────────────────────

interface SessionRow {
  id: string;
  numero_affichage: string;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
  places_max: number | null;
  archived_at: string | null;
  created_at: string;
  produits_formation: { intitule: string } | null;
  session_formateurs: { formateur_id: string; formateurs: { prenom: string; nom: string } | null }[];
  inscriptions: { id: string }[];
  session_commanditaires: { id: string; budget: number; entreprises: { nom: string } | null }[];
}

// ─── Helpers ─────────────────────────────────────────────

// Statut config imported from shared component
import {
  SessionStatusBadge,
  SESSION_STATUT_CONFIG,
  SESSION_STATUT_OPTIONS,
} from "@/components/shared/session-status-badge";

// ─── Columns ─────────────────────────────────────────────

const columns: Column<SessionRow>[] = [
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
    key: "statut",
    label: "Statut",
    filterType: "select",
    filterOptions: SESSION_STATUT_OPTIONS,
    minWidth: 110,
    render: (item) => (
      <SessionStatusBadge statut={item.statut} archived={!!item.archived_at} />
    ),
  },
  {
    key: "nom",
    label: "Nom",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10">
          <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-medium">{item.nom}</span>
          {item.produits_formation?.intitule && (
            <span className="block truncate text-xs text-muted-foreground/60">
              {item.produits_formation.intitule}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "dates",
    label: "Dates",
    minWidth: 160,
    render: (item) => {
      if (!item.date_debut) return <span className="text-muted-foreground/40">--</span>;
      const debut = formatDate(item.date_debut);
      const fin = item.date_fin ? formatDate(item.date_fin) : "";
      return (
        <span className="text-sm text-muted-foreground">
          {debut}{fin ? ` → ${fin}` : ""}
        </span>
      );
    },
  },
  {
    key: "apprenants",
    label: "Apprenants",
    minWidth: 100,
    render: (item) => {
      const count = item.inscriptions?.length ?? 0;
      return (
        <span className="flex items-center gap-1.5 text-sm">
          <Users className="h-3 w-3 text-muted-foreground/60" />
          {count}{item.places_max ? `/${item.places_max}` : ""}
        </span>
      );
    },
  },
  {
    key: "budget",
    label: "Budget",
    minWidth: 120,
    render: (item) => {
      const total = (item.session_commanditaires ?? []).reduce(
        (sum, c) => sum + (Number(c.budget) || 0), 0
      );
      return total > 0
        ? <span className="font-mono text-sm">{formatCurrency(total)}</span>
        : <span className="text-muted-foreground/40">--</span>;
    },
    exportValue: (item) => {
      const total = (item.session_commanditaires ?? []).reduce(
        (sum, c) => sum + (Number(c.budget) || 0), 0
      );
      return total > 0 ? total.toString() : "";
    },
  },
  {
    key: "commanditaires",
    label: "Commanditaire(s)",
    minWidth: 180,
    render: (item) => {
      const noms = (item.session_commanditaires ?? [])
        .map((c) => c.entreprises?.nom)
        .filter(Boolean);
      if (noms.length === 0) return <span className="text-muted-foreground/40">--</span>;
      return <span className="text-sm truncate max-w-[180px]">{noms.join(", ")}</span>;
    },
    exportValue: (item) =>
      (item.session_commanditaires ?? []).map((c) => c.entreprises?.nom).filter(Boolean).join(", "),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page Component ──────────────────────────────────────

export default function SessionsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<SessionRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getSessions(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as SessionRow[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    setDialogOpen(false);
    fetchData();
    toast({
      title: "Session créée",
      description: "La session de formation a été créée avec succès.",
      variant: "success",
    });
  };

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  return (
    <>
      <DataTable
        title="Sessions de formation"
        tableId="sessions"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouvelle session"
        onRowClick={(item) => router.push(`/sessions/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="sessions"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveSession(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} session(s) archivée(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveSession(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} session(s) restaurée(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteSessions(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} session(s) supprimée(s).`, variant: "success" });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle session de formation</DialogTitle>
            <DialogDescription>
              Créez une session de formation. Vous pourrez compléter les détails ensuite.
            </DialogDescription>
          </DialogHeader>
          <CreateSessionForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateSessionForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [form, setForm] = React.useState<CreateSessionInput>({
    nom: "",
    statut: "en_creation",
    date_debut: "",
    date_fin: "",
    emargement_auto: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createSession(form);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSuccess();
  };

  const updateField = (field: keyof CreateSessionInput, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form.join(", ")}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-sm">
          Nom de la session <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          value={form.nom}
          onChange={(e) => updateField("nom", e.target.value)}
          placeholder="Ex: Formation React avancé - Janvier 2026"
          className="h-9 text-sm border-border/60"
        />
        {errors.nom && (
          <p className="text-xs text-destructive">{errors.nom[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date_debut" className="text-sm">
            Date de début
          </Label>
          <DatePicker
            id="date_debut"
            value={form.date_debut ?? ""}
            onChange={(val) => updateField("date_debut", val)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_fin" className="text-sm">
            Date de fin
          </Label>
          <DatePicker
            id="date_fin"
            value={form.date_fin ?? ""}
            onChange={(val) => updateField("date_fin", val)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="lieu_type" className="text-sm">
          Type de lieu
        </Label>
        <select
          id="lieu_type"
          value={form.lieu_type ?? ""}
          onChange={(e) => updateField("lieu_type", e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
        >
          <option value="">-- Sélectionner --</option>
          <option value="presentiel">Présentiel</option>
          <option value="distanciel">Distanciel</option>
          <option value="mixte">Mixte</option>
        </select>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-8 text-xs border-border/60"
        >
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Création...
            </>
          ) : (
            "Créer la session"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
