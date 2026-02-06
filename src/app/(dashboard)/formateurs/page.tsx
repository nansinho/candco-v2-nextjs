"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCheck, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
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
import { getFormateurs, createFormateur, archiveFormateur, unarchiveFormateur, deleteFormateurs, importFormateurs, type FormateurInput } from "@/actions/formateurs";
import { CsvImport, type ImportColumn } from "@/components/shared/csv-import";
import { formatCurrency, formatDate } from "@/lib/utils";

const FORMATEUR_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "civilite", label: "Civilité", aliases: ["civ", "titre", "gender"] },
  { key: "prenom", label: "Prénom", required: true, aliases: ["first name", "firstname", "prenom formateur"] },
  { key: "nom", label: "Nom", required: true, aliases: ["last name", "lastname", "nom formateur", "nom de famille"] },
  { key: "email", label: "Email", aliases: ["mail", "e-mail", "courriel", "email formateur", "adresse email"] },
  { key: "telephone", label: "Téléphone", aliases: ["tel", "phone", "portable", "mobile", "tel formateur", "numero telephone"] },
  { key: "statut_bpf", label: "Statut BPF", aliases: ["statut", "type formateur", "interne externe", "interne/externe"] },
  { key: "tarif_journalier", label: "Tarif journalier", aliases: ["tarif", "tarif jour", "prix jour", "cout journalier", "tjm", "cout jour ht"] },
  { key: "taux_tva", label: "Taux TVA", aliases: ["tva", "tva formateur"] },
  { key: "nda", label: "NDA", aliases: ["numero declaration activite", "n declaration", "numero da", "declaration activite"] },
  { key: "siret", label: "SIRET", aliases: ["siret formateur", "n siret"] },
  { key: "adresse_rue", label: "Adresse", aliases: ["rue", "adresse postale", "adresse rue", "address", "n et rue"] },
  { key: "adresse_complement", label: "Complément adresse", aliases: ["complement", "adresse complement", "bat", "batiment"] },
  { key: "adresse_cp", label: "Code postal", aliases: ["cp", "zip", "code postal"] },
  { key: "adresse_ville", label: "Ville", aliases: ["city", "commune", "localite"] },
  { key: "competences", label: "Compétences", aliases: ["skills", "specialites", "domaines", "domaines competences"] },
];

interface Formateur {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  statut_bpf: string;
  tarif_journalier: number | null;
  created_at: string;
}

const columns: Column<Formateur>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    className: "w-28",
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.numero_affichage}
      </span>
    ),
  },
  {
    key: "nom_complet",
    label: "Nom",
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/10">
          <UserCheck className="h-3.5 w-3.5 text-emerald-400" />
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
    render: (item) =>
      item.email || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "telephone",
    label: "Téléphone",
    render: (item) =>
      item.telephone || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "statut_bpf",
    label: "Statut BPF",
    className: "w-32",
    render: (item) => (
      <Badge
        className={
          item.statut_bpf === "interne"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
        }
      >
        {item.statut_bpf === "interne" ? "Interne" : "Externe"}
      </Badge>
    ),
  },
  {
    key: "tarif_journalier",
    label: "Tarif/jour",
    className: "w-32",
    render: (item) =>
      item.tarif_journalier != null ? (
        <span className="text-muted-foreground">
          {formatCurrency(item.tarif_journalier)}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "created_at",
    label: "Créé le",
    className: "w-28",
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

export default function FormateursPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Formateur[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string[]>>({});

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
    const result = await getFormateurs(page, debouncedSearch, showArchived);
    setData(result.data as Formateur[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch, showArchived]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form state
  const [formData, setFormData] = React.useState<FormateurInput>({
    civilite: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    statut_bpf: "externe",
    tarif_journalier: undefined,
  });

  const resetForm = () => {
    setFormData({
      civilite: "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      statut_bpf: "externe",
      tarif_journalier: undefined,
    });
    setFormErrors({});
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setFormErrors({});
    const result = await createFormateur(formData);
    setIsSubmitting(false);

    if (result.error) {
      setFormErrors(result.error as Record<string, string[]>);
      return;
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
    toast({
      title: "Formateur créé",
      description: "Le formateur a été ajouté avec succès.",
      variant: "success",
    });
  };

  return (
    <>
      <DataTable
        title="Formateurs"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => {
          resetForm();
          setDialogOpen(true);
        }}
        addLabel="Ajouter un formateur"
        onImport={() => setImportOpen(true)}
        onRowClick={(item) => router.push(`/formateurs/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="formateurs"
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveFormateur(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} élément(s) archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveFormateur(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} élément(s) restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteFormateurs(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} élément(s) supprimé(s) définitivement.`, variant: "success" });
        }}
      />

      {/* Create Formateur Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un formateur</DialogTitle>
            <DialogDescription>
              Renseignez les informations du nouveau formateur.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formErrors._form && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formErrors._form.join(", ")}
              </div>
            )}

            {/* Civilité */}
            <div className="space-y-2">
              <Label htmlFor="civilite" className="text-[13px]">
                Civilité
              </Label>
              <select
                id="civilite"
                value={formData.civilite ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, civilite: e.target.value }))
                }
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
              >
                <option value="">-- Sélectionner --</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>

            {/* Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prenom" className="text-[13px]">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, prenom: e.target.value }))
                  }
                  placeholder="Jean"
                  className="h-9 text-[13px] border-border/60"
                />
                {formErrors.prenom && (
                  <p className="text-xs text-destructive">{formErrors.prenom[0]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom" className="text-[13px]">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nom: e.target.value }))
                  }
                  placeholder="Dupont"
                  className="h-9 text-[13px] border-border/60"
                />
                {formErrors.nom && (
                  <p className="text-xs text-destructive">{formErrors.nom[0]}</p>
                )}
              </div>
            </div>

            {/* Email + Téléphone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="jean@exemple.fr"
                  className="h-9 text-[13px] border-border/60"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email[0]}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone" className="text-[13px]">
                  Téléphone
                </Label>
                <Input
                  id="telephone"
                  value={formData.telephone ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, telephone: e.target.value }))
                  }
                  placeholder="06 12 34 56 78"
                  className="h-9 text-[13px] border-border/60"
                />
              </div>
            </div>

            {/* Statut BPF + Tarif journalier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="statut_bpf" className="text-[13px]">
                  Statut BPF
                </Label>
                <select
                  id="statut_bpf"
                  value={formData.statut_bpf}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      statut_bpf: e.target.value as "interne" | "externe",
                    }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
                >
                  <option value="externe">Externe (sous-traitant)</option>
                  <option value="interne">Interne (salarié)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tarif_journalier" className="text-[13px]">
                  Tarif journalier HT
                </Label>
                <Input
                  id="tarif_journalier"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tarif_journalier ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tarif_journalier: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    }))
                  }
                  placeholder="300.00"
                  className="h-9 text-[13px] border-border/60"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
              className="h-8 text-xs border-border/60"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              size="sm"
              disabled={isSubmitting}
              className="h-8 text-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le formateur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des formateurs"
        description="Importez une liste de formateurs depuis un fichier CSV."
        columns={FORMATEUR_IMPORT_COLUMNS}
        templateFilename="formateurs"
        onImport={async (rows) => {
          const result = await importFormateurs(rows as Parameters<typeof importFormateurs>[0]);
          if (result.success > 0) fetchData();
          return result;
        }}
      />
    </>
  );
}
