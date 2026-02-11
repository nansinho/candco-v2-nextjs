"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Building2, Loader2, Search, MapPin, X } from "lucide-react";
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
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import {
  getApprenants,
  createApprenant,
  archiveApprenant,
  unarchiveApprenant,
  deleteApprenants,
  importApprenants,
  searchEntreprisesForLinking,
  getAgencesForEntreprise,
  type CreateApprenantInput,
} from "@/actions/apprenants";
import { CsvImport, type ImportColumn } from "@/components/shared/csv-import";
import { formatDate } from "@/lib/utils";

const APPRENANT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "civilite", label: "Civilité", aliases: ["civilite", "titre", "civ", "gender"] },
  { key: "nom_complet", label: "Nom complet", aliases: ["nom de lapprenant", "nom de l apprenant", "nom apprenant", "nom complet", "full name", "name"] },
  { key: "prenom", label: "Prénom", aliases: ["first name", "firstname", "prenom apprenant", "prenom de l apprenant"] },
  { key: "nom", label: "Nom", aliases: ["last name", "lastname", "nom de famille"] },
  { key: "nom_naissance", label: "Nom de naissance", aliases: ["maiden name", "nom jeune fille", "nom de naissance"] },
  { key: "email", label: "Email", aliases: ["mail", "e-mail", "courriel", "email apprenant", "adresse email", "adresse e mail", "adresse e-mail", "adresse e mail de l apprenant", "adresse e-mail de contact"] },
  { key: "telephone", label: "Téléphone", aliases: ["tel", "phone", "portable", "mobile", "tel apprenant", "numero de telephone", "numero telephone", "n de telephone"] },
  { key: "date_naissance", label: "Date de naissance", aliases: ["birthday", "date naissance", "date de naissance", "ne le", "ne(e) le"] },
  { key: "fonction", label: "Fonction", aliases: ["poste", "job", "metier", "emploi", "fonction apprenant"] },
  { key: "lieu_activite", label: "Lieu d'activité", aliases: ["lieu activite", "lieu d activite", "site", "etablissement"] },
  { key: "adresse_rue", label: "Adresse", aliases: ["rue", "adresse postale", "adresse rue", "address", "n et rue", "adresse postale apprenant"] },
  { key: "adresse_complement", label: "Complément adresse", aliases: ["complement", "adresse complement", "complement adresse", "complement d adresse", "bat", "batiment"] },
  { key: "adresse_cp", label: "Code postal", aliases: ["cp", "zip", "code postal", "postal code"] },
  { key: "adresse_ville", label: "Ville", aliases: ["city", "commune", "localite"] },
  { key: "numero_compte_comptable", label: "N° compte comptable", aliases: ["compte comptable", "compte client", "numero compte", "n compte comptable", "numero de compte comptable"] },
  { key: "statut_bpf", label: "Statut BPF", aliases: ["statut bpf par defaut", "statut bpf", "bpf", "categorie bpf"] },
  { key: "entreprise_nom", label: "Entreprise", aliases: ["entreprises", "entreprise", "societe", "company", "nom entreprise", "nom de l entreprise"] },
  { key: "created_at", label: "Date de création", aliases: ["date de creation", "date creation", "cree le", "created at"] },
];

interface Apprenant {
  id: string;
  numero_affichage: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string;
  bpf_categories_apprenant: { code: string; libelle: string } | null;
  apprenant_entreprises: { entreprise_id: string; entreprises: { nom: string } | null }[];
}

const columns: Column<Apprenant>[] = [
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
    minWidth: 200,
    filterType: "text",
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10">
          <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <span className="font-medium">
          {item.prenom} {item.nom}
        </span>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    minWidth: 200,
    filterType: "text",
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
    key: "entreprises",
    label: "Entreprise(s)",
    minWidth: 200,
    render: (item) => {
      const entreprises = (item.apprenant_entreprises ?? [])
        .map((ae) => ae.entreprises?.nom)
        .filter(Boolean);
      if (entreprises.length === 0) return <span className="text-muted-foreground/40">--</span>;
      return (
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className="text-sm truncate max-w-[200px]">{entreprises.join(", ")}</span>
        </div>
      );
    },
    exportValue: (item) =>
      (item.apprenant_entreprises ?? []).map((ae) => ae.entreprises?.nom).filter(Boolean).join(", "),
  },
  {
    key: "bpf",
    label: "BPF",
    minWidth: 80,
    render: (item) =>
      item.bpf_categories_apprenant ? (
        <span className="text-xs text-muted-foreground" title={item.bpf_categories_apprenant.libelle}>
          {item.bpf_categories_apprenant.code}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
    exportValue: (item) => item.bpf_categories_apprenant?.code ?? "",
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

export default function ApprenantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Apprenant[]>([]);
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
    try {
      const result = await getApprenants(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as Apprenant[]);
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
      title: "Apprenant créé",
      description: "L'apprenant a été ajouté avec succès.",
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
        title="Apprenants"
        tableId="apprenants"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter un apprenant"
        onImport={() => setImportOpen(true)}
        onRowClick={(item) => router.push(`/apprenants/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="apprenants"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveApprenant(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} élément(s) archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveApprenant(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} élément(s) restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteApprenants(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} élément(s) supprimé(s) définitivement.`, variant: "success" });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un apprenant</DialogTitle>
            <DialogDescription>
              Renseignez les informations du nouvel apprenant.
            </DialogDescription>
          </DialogHeader>
          <CreateApprenantForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <CsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des apprenants"
        description="Importez une liste d'apprenants depuis un fichier CSV, Excel ou JSON (SmartOF)."
        columns={APPRENANT_IMPORT_COLUMNS}
        templateFilename="apprenants"
        onImport={async (rows) => {
          const result = await importApprenants(rows as Parameters<typeof importApprenants>[0]);
          if (result.success > 0) fetchData();
          return result;
        }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Create form (inside the dialog)
// ---------------------------------------------------------------------------

interface FormErrors {
  civilite?: string[];
  prenom?: string[];
  nom?: string[];
  email?: string[];
  telephone?: string[];
  date_naissance?: string[];
  _form?: string[];
}

interface EntrepriseOption {
  id: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface AgenceOption {
  id: string;
  nom: string;
  est_siege: boolean;
  adresse_ville: string | null;
}

function CreateApprenantForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});

  // Enterprise state
  const [entSearch, setEntSearch] = React.useState("");
  const [entResults, setEntResults] = React.useState<EntrepriseOption[]>([]);
  const [entSearching, setEntSearching] = React.useState(false);
  const [selectedEntreprise, setSelectedEntreprise] = React.useState<EntrepriseOption | null>(null);

  // Agency state
  const [agences, setAgences] = React.useState<AgenceOption[]>([]);
  const [selectedAgenceIds, setSelectedAgenceIds] = React.useState<string[]>([]);
  const [estSiege, setEstSiege] = React.useState(false);

  // Enterprise search debounce
  React.useEffect(() => {
    if (!entSearch.trim()) {
      setEntResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setEntSearching(true);
      const result = await searchEntreprisesForLinking(entSearch, []);
      setEntResults(result.data as EntrepriseOption[]);
      setEntSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [entSearch]);

  // Load agencies when enterprise is selected
  React.useEffect(() => {
    if (!selectedEntreprise) {
      setAgences([]);
      setSelectedAgenceIds([]);
      setEstSiege(false);
      return;
    }
    (async () => {
      const result = await getAgencesForEntreprise(selectedEntreprise.id);
      setAgences(result.data as AgenceOption[]);
    })();
  }, [selectedEntreprise]);

  const handleSelectEntreprise = (ent: EntrepriseOption) => {
    setSelectedEntreprise(ent);
    setEntSearch("");
    setEntResults([]);
    setSelectedAgenceIds([]);
    setEstSiege(false);
  };

  const handleRemoveEntreprise = () => {
    setSelectedEntreprise(null);
    setAgences([]);
    setSelectedAgenceIds([]);
    setEstSiege(false);
  };

  const toggleAgence = (agenceId: string) => {
    setSelectedAgenceIds((prev) =>
      prev.includes(agenceId) ? prev.filter((id) => id !== agenceId) : [...prev, agenceId],
    );
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const input: CreateApprenantInput = {
      civilite: (formData.get("civilite") as string) || undefined,
      prenom: formData.get("prenom") as string,
      nom: formData.get("nom") as string,
      email: (formData.get("email") as string) || undefined,
      telephone: (formData.get("telephone") as string) || undefined,
      date_naissance: (formData.get("date_naissance") as string) || undefined,
      // Enterprise attachment
      entreprise_id: selectedEntreprise?.id || undefined,
      est_siege: selectedEntreprise ? estSiege : undefined,
      agence_ids: selectedEntreprise && selectedAgenceIds.length > 0 ? selectedAgenceIds : undefined,
    };

    const result = await createApprenant(input);

    if (result.error) {
      setErrors(result.error as FormErrors);
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
          {errors._form[0]}
        </div>
      )}

      {/* Civilité */}
      <div className="space-y-2">
        <Label htmlFor="civilite" className="text-sm">
          Civilité
        </Label>
        <select
          id="civilite"
          name="civilite"
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
        >
          <option value="">-- Sélectionner --</option>
          <option value="Monsieur">Monsieur</option>
          <option value="Madame">Madame</option>
        </select>
      </div>

      {/* Prénom / Nom */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prenom" className="text-sm">
            Prénom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prenom"
            name="prenom"
            placeholder="Jean"
            className="h-9 text-sm border-border/60"
          />
          {errors.prenom && (
            <p className="text-xs text-destructive">{errors.prenom[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom" className="text-sm">
            Nom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nom"
            name="nom"
            placeholder="Dupont"
            className="h-9 text-sm border-border/60"
          />
          {errors.nom && (
            <p className="text-xs text-destructive">{errors.nom[0]}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="jean.dupont@example.com"
          className="h-9 text-sm border-border/60"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      {/* Téléphone */}
      <div className="space-y-2">
        <Label htmlFor="telephone" className="text-sm">
          Téléphone
        </Label>
        <Input
          id="telephone"
          name="telephone"
          placeholder="06 12 34 56 78"
          className="h-9 text-sm border-border/60"
        />
      </div>

      {/* Date de naissance */}
      <div className="space-y-2">
        <Label htmlFor="date_naissance" className="text-sm">
          Date de naissance
        </Label>
        <DatePicker
          id="date_naissance"
          name="date_naissance"
        />
      </div>

      {/* Enterprise attachment */}
      <fieldset className="space-y-3 rounded-md border border-border/40 p-3">
        <legend className="px-1 text-xs font-semibold text-muted-foreground/80 uppercase tracking-wider">
          Rattachement entreprise
        </legend>

        {!selectedEntreprise ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Rechercher une entreprise..."
                value={entSearch}
                onChange={(e) => setEntSearch(e.target.value)}
                className="h-8 pl-8 text-xs border-border/60"
              />
            </div>
            {entSearching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />Recherche...
              </div>
            )}
            {entResults.length > 0 && (
              <div className="space-y-0.5 max-h-[150px] overflow-y-auto">
                {entResults.map((ent) => (
                  <button
                    key={ent.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                    onClick={() => handleSelectEntreprise(ent)}
                  >
                    <Building2 className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                    <span className="text-xs font-medium truncate">{ent.nom}</span>
                    {ent.adresse_ville && (
                      <span className="text-xs text-muted-foreground/40 truncate">{ent.adresse_ville}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {entSearch.trim() && !entSearching && entResults.length === 0 && (
              <p className="text-xs text-muted-foreground/50">Aucune entreprise trouvée</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Selected enterprise */}
            <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-orange-400" />
                <span className="text-xs font-medium">{selectedEntreprise.nom}</span>
                {selectedEntreprise.adresse_ville && (
                  <span className="text-xs text-muted-foreground/40">{selectedEntreprise.adresse_ville}</span>
                )}
              </div>
              <button
                type="button"
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-foreground"
                onClick={handleRemoveEntreprise}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Headquarters checkbox */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={estSiege || selectedAgenceIds.length === 0}
                onChange={(e) => setEstSiege(e.target.checked)}
                disabled={selectedAgenceIds.length === 0}
                className="h-3.5 w-3.5 rounded border-border accent-primary"
              />
              <span className="text-xs">
                Siège social
                {selectedAgenceIds.length === 0 && (
                  <span className="ml-1 text-xs text-muted-foreground/50">(par défaut si aucune agence)</span>
                )}
              </span>
            </label>

            {/* Agencies */}
            {agences.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground/60 font-medium">Agences :</p>
                <div className="space-y-1 max-h-[120px] overflow-y-auto">
                  {agences.map((ag) => (
                    <label
                      key={ag.id}
                      className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/20 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAgenceIds.includes(ag.id)}
                        onChange={() => toggleAgence(ag.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-primary"
                      />
                      <MapPin className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                      <span className="text-xs">{ag.nom}</span>
                      {ag.est_siege && (
                        <span className="text-xs font-medium text-orange-400/80 bg-orange-400/10 px-1 py-0.5 rounded">siège</span>
                      )}
                      {ag.adresse_ville && (
                        <span className="text-xs text-muted-foreground/40">{ag.adresse_ville}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {agences.length === 0 && (
              <p className="text-xs text-muted-foreground/40 italic">
                Aucune agence définie pour cette entreprise. L&apos;apprenant sera rattaché au siège social.
              </p>
            )}
          </div>
        )}
      </fieldset>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
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
            "Créer l'apprenant"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
