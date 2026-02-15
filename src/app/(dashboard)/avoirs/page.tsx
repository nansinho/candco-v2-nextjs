"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileX, Building2, Loader2, Receipt } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getAvoirsList,
  createAvoir,
  archiveAvoir,
  unarchiveAvoir,
  deleteAvoirsBulk,
  getFacturesForSelect,
  type CreateAvoirInput,
} from "@/actions/avoirs";
import { getEntreprisesForSelect } from "@/actions/devis";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  AvoirStatusBadge,
  AVOIR_STATUT_OPTIONS,
} from "@/components/shared/status-badges";
import { LignesEditor, type LigneItem } from "@/components/shared/lignes-editor";

// ─── Types ───────────────────────────────────────────────

interface AvoirRow {
  id: string;
  numero_affichage: string;
  motif: string | null;
  statut: string;
  date_emission: string;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  archived_at: string | null;
  created_at: string;
  entreprises: { nom: string } | null;
  factures: { numero_affichage: string } | null;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AvoirRow>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    sortable: true,
    minWidth: 120,
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
    filterOptions: AVOIR_STATUT_OPTIONS,
    minWidth: 110,
    render: (item) => <AvoirStatusBadge statut={item.statut} />,
  },
  {
    key: "motif",
    label: "Motif",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-red-500/10">
          <FileX className="h-3.5 w-3.5 text-red-400" />
        </div>
        <span className="truncate font-medium">{item.motif || "Sans motif"}</span>
      </div>
    ),
  },
  {
    key: "facture",
    label: "Facture liée",
    minWidth: 130,
    render: (item) =>
      item.factures?.numero_affichage ? (
        <span className="flex items-center gap-1.5 text-sm">
          <Receipt className="h-3 w-3 text-muted-foreground/60" />
          {item.factures.numero_affichage}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "entreprise",
    label: "Entreprise",
    minWidth: 180,
    render: (item) =>
      item.entreprises?.nom ? (
        <span className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3 w-3 text-muted-foreground/60" />
          <span className="truncate">{item.entreprises.nom}</span>
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
    exportValue: (item) => item.entreprises?.nom ?? "",
  },
  {
    key: "total_ttc",
    label: "Montant TTC",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <span className="font-mono text-sm text-red-400">
        -{formatCurrency(Number(item.total_ttc) || 0)}
      </span>
    ),
    exportValue: (item) => item.total_ttc?.toString() ?? "0",
  },
  {
    key: "date_emission",
    label: "Émission",
    sortable: true,
    filterType: "date",
    minWidth: 110,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {formatDate(item.date_emission)}
      </span>
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

// ─── Page Component ──────────────────────────────────────

export default function AvoirsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AvoirRow[]>([]);
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
      const result = await getAvoirsList(
        page,
        debouncedSearch,
        showArchived,
        sortBy,
        sortDir,
        filters,
      );
      setData(result.data as AvoirRow[]);
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
      <DataTable
        title="Avoirs"
        tableId="avoirs"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouvel avoir"
        onRowClick={(item) => router.push(`/avoirs/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="avoirs"
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
          await Promise.all(ids.map((id) => archiveAvoir(id)));
          await fetchData();
          toast({
            title: "Archivé",
            description: `${ids.length} avoir(s) archivé(s).`,
            variant: "success",
          });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveAvoir(id)));
          setShowArchived(false);
          toast({
            title: "Restauré",
            description: `${ids.length} avoir(s) restauré(s).`,
            variant: "success",
          });
        }}
        onDelete={async (ids) => {
          const result = await deleteAvoirsBulk(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({
            title: "Supprimé",
            description: `${ids.length} avoir(s) supprimé(s).`,
            variant: "success",
          });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvel avoir</DialogTitle>
            <DialogDescription>
              Créez un avoir. Vous pouvez le lier à une facture existante.
            </DialogDescription>
          </DialogHeader>
          <CreateAvoirForm
            onSuccess={() => {
              setDialogOpen(false);
              fetchData();
              toast({
                title: "Avoir créé",
                description: "L'avoir a été créé avec succès.",
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

function CreateAvoirForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facturesOptions, setFacturesOptions] = React.useState<any[]>([]);
  const [entreprises, setEntreprises] = React.useState<
    { id: string; nom: string; numero_affichage: string }[]
  >([]);
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);
  const [form, setForm] = React.useState({
    facture_id: "",
    entreprise_id: "",
    date_emission: new Date().toISOString().split("T")[0],
    motif: "",
    statut: "brouillon" as const,
  });

  React.useEffect(() => {
    getFacturesForSelect().then(setFacturesOptions);
    getEntreprisesForSelect().then(setEntreprises);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const input: CreateAvoirInput = {
      ...form,
      lignes: lignes.map((l) => ({
        designation: l.designation,
        description: l.description,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        taux_tva: l.taux_tva,
        ordre: l.ordre,
      })),
    };

    const result = await createAvoir(input);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form.join(", ")}
        </div>
      )}

      <div className="space-y-2">
        <Label className="text-sm">Facture liée (optionnel)</Label>
        <select
          value={form.facture_id}
          onChange={(e) => setForm((prev) => ({ ...prev, facture_id: e.target.value }))}
          className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
        >
          <option value="">-- Aucune facture --</option>
          {facturesOptions.map((f) => (
            <option key={f.id} value={f.id}>
              {f.numero_affichage} — {f.entreprises?.nom ?? "?"} ({formatCurrency(Number(f.total_ttc))})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Entreprise</Label>
          <select
            value={form.entreprise_id}
            onChange={(e) => setForm((prev) => ({ ...prev, entreprise_id: e.target.value }))}
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="">-- Sélectionner --</option>
            {entreprises.map((e) => (
              <option key={e.id} value={e.id}>{e.nom}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm">
            Date d'émission <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            value={form.date_emission}
            onChange={(val) => setForm((prev) => ({ ...prev, date_emission: val }))}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Motif</Label>
        <Textarea
          value={form.motif}
          onChange={(e) => setForm((prev) => ({ ...prev, motif: e.target.value }))}
          placeholder="Motif de l'avoir..."
          className="min-h-[60px] text-sm border-border/60"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Lignes de l'avoir</Label>
        <div className="rounded-lg border border-border/40 p-3">
          <LignesEditor lignes={lignes} onChange={setLignes} />
        </div>
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
            "Créer l'avoir"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
