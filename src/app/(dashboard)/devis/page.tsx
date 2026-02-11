"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2 } from "lucide-react";
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
  getDevisList,
  createDevis,
  archiveDevis,
  unarchiveDevis,
  deleteDevisBulk,
  getEntreprisesForSelect,
  getContactsForSelect,
  type CreateDevisInput,
} from "@/actions/devis";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { LignesEditor, type LigneItem } from "@/components/shared/lignes-editor";
import {
  DevisStatusBadge,
  DEVIS_STATUT_OPTIONS,
} from "@/components/shared/status-badges";

// ─── Types ───────────────────────────────────────────────

interface DevisRow {
  id: string;
  numero_affichage: string;
  objet: string | null;
  statut: string;
  date_emission: string;
  date_echeance: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  particulier_nom: string | null;
  archived_at: string | null;
  created_at: string;
  entreprises: { nom: string } | null;
  contacts_clients: { prenom: string; nom: string } | null;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<DevisRow>[] = [
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
    filterOptions: DEVIS_STATUT_OPTIONS,
    minWidth: 110,
    render: (item) => (
      <DevisStatusBadge statut={item.statut} />
    ),
  },
  {
    key: "objet",
    label: "Objet",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10">
          <FileText className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-medium">
            {item.objet || <span className="text-muted-foreground/40">Sans objet</span>}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "destinataire",
    label: "Destinataire",
    minWidth: 180,
    render: (item) => {
      const dest = item.entreprises?.nom || item.particulier_nom || "--";
      return (
        <span className="text-sm text-muted-foreground truncate max-w-[180px]">
          {dest}
        </span>
      );
    },
    exportValue: (item) => item.entreprises?.nom || item.particulier_nom || "",
  },
  {
    key: "total_ttc",
    label: "Montant TTC",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <span className="font-mono text-sm">{formatCurrency(item.total_ttc)}</span>
    ),
    exportValue: (item) => item.total_ttc.toString(),
  },
  {
    key: "date_emission",
    label: "Émission",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.date_emission)}</span>
    ),
  },
  {
    key: "date_echeance",
    label: "Échéance",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-muted-foreground">
        {item.date_echeance ? formatDate(item.date_echeance) : "--"}
      </span>
    ),
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

export default function DevisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<DevisRow[]>([]);
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
      const result = await getDevisList(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as DevisRow[]);
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
      title: "Devis créé",
      description: "Le devis a été créé avec succès.",
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
        title="Devis"
        tableId="devis"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouveau devis"
        onRowClick={(item) => router.push(`/devis/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="devis"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveDevis(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} devis archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveDevis(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} devis restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteDevisBulk(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} devis supprimé(s).`, variant: "success" });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Nouveau devis</DialogTitle>
            <DialogDescription>
              Créez un devis. Vous pourrez compléter les détails ensuite.
            </DialogDescription>
          </DialogHeader>
          <CreateDevisForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateDevisForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [entreprises, setEntreprises] = React.useState<{ id: string; nom: string }[]>([]);
  const [contacts, setContacts] = React.useState<{ id: string; prenom: string; nom: string }[]>([]);
  const [isParticulier, setIsParticulier] = React.useState(false);
  const [form, setForm] = React.useState<CreateDevisInput>({
    entreprise_id: "",
    contact_client_id: "",
    particulier_nom: "",
    particulier_email: "",
    particulier_telephone: "",
    particulier_adresse: "",
    date_emission: new Date().toISOString().split("T")[0],
    date_echeance: "",
    objet: "",
    conditions: "",
    mentions_legales: "",
    statut: "brouillon",
    opportunite_id: "",
    session_id: "",
    lignes: [],
  });

  React.useEffect(() => {
    async function load() {
      const [ent, cont] = await Promise.all([
        getEntreprisesForSelect(),
        getContactsForSelect(),
      ]);
      setEntreprises(ent);
      setContacts(cont);
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createDevis(form);

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

  const updateField = (field: keyof CreateDevisInput, value: string | LigneItem[]) => {
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
        <Label htmlFor="objet" className="text-sm">
          Objet
        </Label>
        <Input
          id="objet"
          value={form.objet}
          onChange={(e) => updateField("objet", e.target.value)}
          placeholder="Ex: Formation React avancé"
          className="h-9 text-sm border-border/60"
        />
        {errors.objet && (
          <p className="text-xs text-destructive">{errors.objet[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="particulier"
            checked={isParticulier}
            onChange={(e) => setIsParticulier(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="particulier" className="text-sm">
            Particulier (sans entreprise)
          </Label>
        </div>
      </div>

      {!isParticulier ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="entreprise_id" className="text-sm">
              Entreprise
            </Label>
            <select
              id="entreprise_id"
              value={form.entreprise_id}
              onChange={(e) => updateField("entreprise_id", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
            >
              <option value="">-- Sélectionner une entreprise --</option>
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_client_id" className="text-sm">
              Contact client
            </Label>
            <select
              id="contact_client_id"
              value={form.contact_client_id}
              onChange={(e) => updateField("contact_client_id", e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
            >
              <option value="">-- Sélectionner un contact --</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom}
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="particulier_nom" className="text-sm">
              Nom du particulier <span className="text-destructive">*</span>
            </Label>
            <Input
              id="particulier_nom"
              value={form.particulier_nom}
              onChange={(e) => updateField("particulier_nom", e.target.value)}
              placeholder="Ex: Jean Dupont"
              className="h-9 text-sm border-border/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="particulier_email" className="text-sm">
                Email
              </Label>
              <Input
                id="particulier_email"
                type="email"
                value={form.particulier_email}
                onChange={(e) => updateField("particulier_email", e.target.value)}
                placeholder="email@exemple.com"
                className="h-9 text-sm border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="particulier_telephone" className="text-sm">
                Téléphone
              </Label>
              <Input
                id="particulier_telephone"
                value={form.particulier_telephone}
                onChange={(e) => updateField("particulier_telephone", e.target.value)}
                placeholder="06 12 34 56 78"
                className="h-9 text-sm border-border/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="particulier_adresse" className="text-sm">
              Adresse
            </Label>
            <Input
              id="particulier_adresse"
              value={form.particulier_adresse}
              onChange={(e) => updateField("particulier_adresse", e.target.value)}
              placeholder="Adresse complète"
              className="h-9 text-sm border-border/60"
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date_emission" className="text-sm">
            Date d'émission <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="date_emission"
            value={form.date_emission}
            onChange={(val) => updateField("date_emission", val)}
          />
          {errors.date_emission && (
            <p className="text-xs text-destructive">{errors.date_emission[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_echeance" className="text-sm">
            Date d'échéance
          </Label>
          <DatePicker
            id="date_echeance"
            value={form.date_echeance ?? ""}
            onChange={(val) => updateField("date_echeance", val)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Lignes du devis</Label>
        <LignesEditor
          lignes={form.lignes}
          onChange={(lignes) => updateField("lignes", lignes)}
        />
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
            "Créer le devis"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
