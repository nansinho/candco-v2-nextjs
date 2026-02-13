"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Target, Building2, Loader2 } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import {
  getOpportunites,
  createOpportunite,
  archiveOpportunite,
  unarchiveOpportunite,
  deleteOpportunites,
  getOpportunitePipelineStats,
  type CreateOpportuniteInput,
} from "@/actions/opportunites";
import { getEntreprisesForSelect, getContactsForSelect } from "@/actions/devis";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import {
  OpportuniteStatusBadge,
  OPPORTUNITE_STATUT_OPTIONS,
  OPPORTUNITE_STATUT_CONFIG,
} from "@/components/shared/status-badges";

// ─── Types ───────────────────────────────────────────────

interface OpportuniteRow {
  id: string;
  nom: string;
  statut: string;
  montant_estime: number | null;
  date_cloture_prevue: string | null;
  source: string | null;
  archived_at: string | null;
  created_at: string;
  entreprises: { nom: string } | null;
  contacts_clients: { prenom: string; nom: string } | null;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<OpportuniteRow>[] = [
  {
    key: "nom",
    label: "Nom",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Target className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="truncate font-medium">{item.nom}</span>
      </div>
    ),
  },
  {
    key: "statut",
    label: "Statut",
    filterType: "select",
    filterOptions: OPPORTUNITE_STATUT_OPTIONS,
    minWidth: 130,
    render: (item) => <OpportuniteStatusBadge statut={item.statut} />,
  },
  {
    key: "montant_estime",
    label: "Montant estimé",
    sortable: true,
    minWidth: 130,
    render: (item) =>
      item.montant_estime != null ? (
        <span className="font-mono text-sm">{formatCurrency(item.montant_estime)}</span>
      ) : (
        <span className="text-muted-foreground-subtle">--</span>
      ),
    exportValue: (item) => item.montant_estime?.toString() ?? "",
  },
  {
    key: "entreprise",
    label: "Entreprise",
    minWidth: 180,
    render: (item) =>
      item.entreprises?.nom ? (
        <span className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3 w-3 text-muted-foreground-subtle" />
          <span className="truncate">{item.entreprises.nom}</span>
        </span>
      ) : (
        <span className="text-muted-foreground-subtle">--</span>
      ),
    exportValue: (item) => item.entreprises?.nom ?? "",
  },
  {
    key: "contact",
    label: "Contact",
    minWidth: 150,
    render: (item) =>
      item.contacts_clients ? (
        <span className="text-sm">
          {item.contacts_clients.prenom} {item.contacts_clients.nom}
        </span>
      ) : (
        <span className="text-muted-foreground-subtle">--</span>
      ),
  },
  {
    key: "date_cloture_prevue",
    label: "Clôture prévue",
    sortable: true,
    filterType: "date",
    minWidth: 120,
    render: (item) =>
      item.date_cloture_prevue ? (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.date_cloture_prevue)}
        </span>
      ) : (
        <span className="text-muted-foreground-subtle">--</span>
      ),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Pipeline Stats Component ────────────────────────────

function PipelineStats() {
  const [stats, setStats] = React.useState<
    { statut: string; count: number; total: number }[]
  >([]);

  React.useEffect(() => {
    getOpportunitePipelineStats().then(setStats);
  }, []);

  if (stats.length === 0) return null;

  const activeStats = stats.filter((s) => s.statut !== "perdu");
  const totalPipeline = activeStats.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {stats.map((s) => {
        const config = OPPORTUNITE_STATUT_CONFIG[s.statut];
        return (
          <div
            key={s.statut}
            className="flex min-w-[120px] flex-col rounded-lg border border-border/40 bg-card px-3 py-2"
          >
            <span className="text-xs text-muted-foreground">{config?.label ?? s.statut}</span>
            <span className="text-lg font-semibold">{s.count}</span>
            {s.total > 0 && (
              <span className="text-xs font-mono text-muted-foreground">
                {formatCurrency(s.total)}
              </span>
            )}
          </div>
        );
      })}
      <div className="flex min-w-[120px] flex-col rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
        <span className="text-xs text-primary/70">Pipeline total</span>
        <span className="text-lg font-semibold text-primary">{formatCurrency(totalPipeline)}</span>
      </div>
    </div>
  );
}

// ─── Page Component ──────────────────────────────────────

export default function OpportunitesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<OpportuniteRow[]>([]);
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
      const result = await getOpportunites(
        page,
        debouncedSearch,
        showArchived,
        sortBy,
        sortDir,
        filters,
      );
      setData(result.data as OpportuniteRow[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <>
      <div className="mb-4">
        <PipelineStats />
      </div>

      <DataTable
        title="Opportunités commerciales"
        tableId="opportunites"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouvelle opportunité"
        onRowClick={(item) => router.push(`/opportunites/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="opportunites"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(key, dir) => {
          setSortBy(key);
          setSortDir(dir);
          setPage(1);
        }}
        filters={filters}
        onFiltersChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        showArchived={showArchived}
        onToggleArchived={(show) => {
          setShowArchived(show);
          setPage(1);
        }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveOpportunite(id)));
          await fetchData();
          toast({
            title: "Archivé",
            description: `${ids.length} opportunité(s) archivée(s).`,
            variant: "success",
          });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveOpportunite(id)));
          setShowArchived(false);
          toast({
            title: "Restauré",
            description: `${ids.length} opportunité(s) restaurée(s).`,
            variant: "success",
          });
        }}
        onDelete={async (ids) => {
          const result = await deleteOpportunites(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({
            title: "Supprimé",
            description: `${ids.length} opportunité(s) supprimée(s).`,
            variant: "success",
          });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle opportunité</DialogTitle>
            <DialogDescription>
              Créez une nouvelle opportunité commerciale pour suivre votre pipeline.
            </DialogDescription>
          </DialogHeader>
          <CreateOpportuniteForm
            onSuccess={() => {
              setDialogOpen(false);
              fetchData();
              toast({
                title: "Opportunité créée",
                description: "L'opportunité a été créée avec succès.",
                variant: "success",
              });
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateOpportuniteForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [entreprises, setEntreprises] = React.useState<
    { id: string; nom: string; numero_affichage: string }[]
  >([]);
  const [contacts, setContacts] = React.useState<
    { id: string; prenom: string; nom: string; numero_affichage: string }[]
  >([]);
  const [form, setForm] = React.useState<CreateOpportuniteInput>({
    nom: "",
    statut: "prospect",
  });

  React.useEffect(() => {
    getEntreprisesForSelect().then(setEntreprises);
    getContactsForSelect().then(setContacts);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createOpportunite(form);
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

  const updateField = (field: keyof CreateOpportuniteInput, value: string | number) => {
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
          Nom <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          value={form.nom}
          onChange={(e) => updateField("nom", e.target.value)}
          placeholder="Ex: Formation React pour Acme Corp"
          className="h-9 text-sm border-border/60"
        />
        {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Entreprise</Label>
          <select
            value={form.entreprise_id ?? ""}
            onChange={(e) => updateField("entreprise_id", e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="">-- Sélectionner --</option>
            {entreprises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Contact client</Label>
          <select
            value={form.contact_client_id ?? ""}
            onChange={(e) => updateField("contact_client_id", e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="">-- Sélectionner --</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.prenom} {c.nom}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Montant estimé (EUR)</Label>
          <Input
            type="number"
            value={form.montant_estime ?? ""}
            onChange={(e) => updateField("montant_estime", Number(e.target.value))}
            placeholder="0.00"
            className="h-9 text-sm border-border/60"
            step="0.01"
            min="0"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Clôture prévue</Label>
          <DatePicker
            value={form.date_cloture_prevue ?? ""}
            onChange={(val) => updateField("date_cloture_prevue", val)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Statut</Label>
        <select
          value={form.statut}
          onChange={(e) => updateField("statut", e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
        >
          {OPPORTUNITE_STATUT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
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
            "Créer l'opportunité"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
