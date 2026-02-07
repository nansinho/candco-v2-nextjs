"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { DataTable, type Column, type ActiveFilter } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getEntreprises, createEntreprise, archiveEntreprise, unarchiveEntreprise, deleteEntreprises, importEntreprises } from "@/actions/entreprises";
import { SiretSearch } from "@/components/shared/siret-search";
import { AddressAutocomplete } from "@/components/shared/address-autocomplete";
import { CsvImport, type ImportColumn } from "@/components/shared/csv-import";
import { formatDate } from "@/lib/utils";

const ENTREPRISE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "nom", label: "Nom", required: true, aliases: ["raison sociale", "nom entreprise", "nom de lentreprise", "nom de l entreprise", "societe", "société", "company", "company name", "denomination"] },
  { key: "siret", label: "SIRET", aliases: ["n siret", "siret entreprise", "numero siret", "siren"] },
  { key: "email", label: "Email", aliases: ["mail", "e-mail", "courriel", "email entreprise", "adresse email", "adresse e mail", "adresse e-mail", "adresse e-mail de contact", "adresse e mail de contact"] },
  { key: "telephone", label: "Téléphone", aliases: ["tel", "phone", "telephone entreprise", "numero telephone", "numero de telephone", "n de telephone"] },
  { key: "adresse_rue", label: "Adresse", aliases: ["rue", "adresse postale", "adresse rue", "address", "n et rue", "adresse"] },
  { key: "adresse_complement", label: "Complément adresse", aliases: ["complement", "adresse complement", "complement adresse", "complement d adresse", "bat", "batiment"] },
  { key: "adresse_cp", label: "Code postal", aliases: ["cp", "zip", "code postal", "postal code"] },
  { key: "adresse_ville", label: "Ville", aliases: ["city", "commune", "localite"] },
  { key: "facturation_raison_sociale", label: "Facturation - Raison sociale", aliases: ["raison sociale facturation", "facturation societe", "facturation raison sociale"] },
  { key: "facturation_rue", label: "Facturation - Adresse", aliases: ["adresse facturation", "facturation adresse", "facturation rue"] },
  { key: "facturation_cp", label: "Facturation - CP", aliases: ["cp facturation", "code postal facturation", "facturation code postal"] },
  { key: "facturation_ville", label: "Facturation - Ville", aliases: ["ville facturation", "facturation ville"] },
  { key: "numero_compte_comptable", label: "N° compte comptable", aliases: ["compte comptable", "compte client", "numero compte", "numero de compte comptable", "n compte comptable"] },
  { key: "bpf_provenance", label: "Provenance BPF", aliases: ["provenance bpf", "provenance des produits bpf par defaut", "provenance des produits bpf", "bpf", "categorie bpf", "bpf par defaut"] },
  { key: "created_at", label: "Date de création", aliases: ["date de creation", "date creation", "cree le", "created at"] },
];

interface Entreprise {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse_ville: string | null;
  created_at: string;
  bpf_categories_entreprise: { code: string; libelle: string } | null;
}

const columns: Column<Entreprise>[] = [
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
    key: "nom",
    label: "Nom",
    sortable: true,
    filterType: "text",
    minWidth: 200,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="font-medium">{item.nom}</span>
      </div>
    ),
  },
  {
    key: "siret",
    label: "SIRET",
    sortable: true,
    filterType: "text",
    minWidth: 150,
    render: (item) =>
      item.siret || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    filterType: "text",
    minWidth: 200,
    render: (item) =>
      item.email || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "telephone",
    label: "Téléphone",
    minWidth: 140,
    render: (item) =>
      item.telephone || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "adresse_ville",
    label: "Ville",
    sortable: true,
    filterType: "text",
    minWidth: 130,
    render: (item) =>
      item.adresse_ville || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "bpf",
    label: "BPF",
    minWidth: 90,
    render: (item) =>
      item.bpf_categories_entreprise ? (
        <span className="text-xs text-muted-foreground" title={item.bpf_categories_entreprise.libelle}>
          {item.bpf_categories_entreprise.code}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
    exportValue: (item) => item.bpf_categories_entreprise?.code ?? "",
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

export default function EntreprisesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Entreprise[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getEntreprises(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
    setData(result.data as Entreprise[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    setDialogOpen(false);
    fetchData();
    toast({
      title: "Entreprise créée",
      description: "L'entreprise a été ajoutée avec succès.",
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
        title="Entreprises"
        tableId="entreprises"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter une entreprise"
        onRowClick={(item) => router.push(`/entreprises/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="entreprises"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveEntreprise(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} élément(s) archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveEntreprise(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} élément(s) restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteEntreprises(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} élément(s) supprimé(s) définitivement.`, variant: "success" });
        }}
        onImport={() => setImportOpen(true)}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une entreprise</DialogTitle>
            <DialogDescription>
              Renseignez les informations principales de l&apos;entreprise.
            </DialogDescription>
          </DialogHeader>
          <CreateEntrepriseForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <CsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des entreprises"
        description="Importez depuis un fichier CSV, Excel ou JSON (export SmartOF)."
        columns={ENTREPRISE_IMPORT_COLUMNS}
        templateFilename="entreprises"
        onImport={async (rows) => {
          const result = await importEntreprises(rows as Parameters<typeof importEntreprises>[0]);
          if (result.success > 0) fetchData();
          return result;
        }}
      />
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

interface CreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateEntrepriseForm({ onSuccess, onCancel }: CreateFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formData, setFormData] = React.useState({
    nom: "",
    siret: "",
    email: "",
    telephone: "",
    adresse_rue: "",
    adresse_cp: "",
    adresse_ville: "",
    est_siege: false,
  });

  const updateField = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createEntreprise(formData);

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
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form[0]}
        </div>
      )}

      {/* SIRET Search */}
      <div className="space-y-2">
        <Label className="text-[13px]">Recherche INSEE (SIRET / Nom)</Label>
        <SiretSearch
          onSelect={(r) => {
            setFormData((prev) => ({
              ...prev,
              nom: r.nom || prev.nom,
              siret: r.siret || prev.siret,
              adresse_rue: r.adresse_rue || prev.adresse_rue,
              adresse_cp: r.adresse_cp || prev.adresse_cp,
              adresse_ville: r.adresse_ville || prev.adresse_ville,
            }));
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-[13px]">
          Nom de l&apos;entreprise <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          name="nom"
          required
          value={formData.nom}
          onChange={(e) => updateField("nom", e.target.value)}
          placeholder="Ex: Acme Corp"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.nom && (
          <p className="text-xs text-destructive">{errors.nom[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="siret" className="text-[13px]">
            SIRET
          </Label>
          <Input
            id="siret"
            name="siret"
            value={formData.siret}
            onChange={(e) => updateField("siret", e.target.value)}
            placeholder="123 456 789 00012"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telephone" className="text-[13px]">
            Téléphone
          </Label>
          <Input
            id="telephone"
            name="telephone"
            value={formData.telephone}
            onChange={(e) => updateField("telephone", e.target.value)}
            placeholder="01 23 45 67 89"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-[13px]">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="contact@entreprise.fr"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-[13px]">Adresse</Label>
        <AddressAutocomplete
          value={formData.adresse_rue}
          onChange={(v) => updateField("adresse_rue", v)}
          onSelect={(r) => {
            setFormData((prev) => ({
              ...prev,
              adresse_rue: r.rue,
              adresse_cp: r.cp,
              adresse_ville: r.ville,
            }));
          }}
          placeholder="Saisissez une adresse..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="adresse_cp" className="text-[13px]">
            Code postal
          </Label>
          <Input
            id="adresse_cp"
            name="adresse_cp"
            value={formData.adresse_cp}
            onChange={(e) => updateField("adresse_cp", e.target.value)}
            placeholder="75001"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresse_ville" className="text-[13px]">
            Ville
          </Label>
          <Input
            id="adresse_ville"
            name="adresse_ville"
            value={formData.adresse_ville}
            onChange={(e) => updateField("adresse_ville", e.target.value)}
            placeholder="Paris"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="est_siege"
          checked={formData.est_siege}
          onChange={(e) => updateField("est_siege", e.target.checked)}
          className="h-4 w-4 rounded border-border/60"
        />
        <Label htmlFor="est_siege" className="text-[13px] font-normal">
          Siège social
        </Label>
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
            "Créer l'entreprise"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
