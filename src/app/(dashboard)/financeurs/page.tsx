"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Landmark, Loader2 } from "lucide-react";
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
import { getFinanceurs, createFinanceur, archiveFinanceur, unarchiveFinanceur, deleteFinanceurs, importFinanceurs } from "@/actions/financeurs";
import { CsvImport, type ImportColumn } from "@/components/shared/csv-import";
import { formatDate } from "@/lib/utils";

const FINANCEUR_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "nom", label: "Nom", required: true, aliases: ["name", "denomination", "raison sociale", "nom financeur", "nom du financeur"] },
  { key: "type", label: "Type", aliases: ["type financeur", "type de financeur", "categorie"] },
  { key: "siret", label: "SIRET", aliases: ["siret financeur", "n siret", "siren"] },
  { key: "email", label: "Email", aliases: ["mail", "e-mail", "courriel", "adresse email", "adresse e mail", "adresse e-mail"] },
  { key: "telephone", label: "Téléphone", aliases: ["tel", "phone", "portable", "numero telephone"] },
  { key: "adresse_rue", label: "Adresse", aliases: ["rue", "adresse postale", "address", "n et rue"] },
  { key: "adresse_complement", label: "Complément adresse", aliases: ["complement", "complement adresse", "batiment"] },
  { key: "adresse_cp", label: "Code postal", aliases: ["cp", "zip", "code postal"] },
  { key: "adresse_ville", label: "Ville", aliases: ["city", "commune", "localite"] },
  { key: "numero_compte_comptable", label: "N° compte comptable", aliases: ["compte comptable", "numero compte", "n compte"] },
  { key: "bpf_categorie", label: "Catégorie BPF", aliases: ["bpf", "code bpf", "statut bpf", "provenance bpf"] },
];

interface Financeur {
  id: string;
  numero_affichage: string;
  nom: string;
  type: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  created_at: string;
  bpf_categories_entreprise: { code: string; libelle: string } | null;
}

const FINANCEUR_TYPES = [
  "OPCO",
  "Pôle Emploi",
  "Région",
  "AGEFIPH",
  "Entreprise",
  "Autre",
] as const;

function typeBadgeClass(type: string | null): string {
  switch (type) {
    case "OPCO":
      return "border-transparent bg-blue-500/15 text-blue-400";
    case "Pôle Emploi":
      return "border-transparent bg-purple-500/15 text-purple-400";
    case "Région":
      return "border-transparent bg-emerald-500/15 text-emerald-400";
    case "AGEFIPH":
      return "border-transparent bg-amber-500/15 text-amber-400";
    case "Entreprise":
      return "border-transparent bg-slate-500/15 text-slate-400";
    case "Autre":
      return "border-transparent bg-gray-500/15 text-gray-400";
    default:
      return "border-transparent bg-gray-500/15 text-gray-500";
  }
}

const columns: Column<Financeur>[] = [
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
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500/10">
          <Landmark className="h-3.5 w-3.5 text-amber-400" />
        </div>
        <span className="font-medium">{item.nom}</span>
      </div>
    ),
  },
  {
    key: "type",
    label: "Type",
    minWidth: 120,
    render: (item) =>
      item.type ? (
        <Badge className={typeBadgeClass(item.type)}>{item.type}</Badge>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "siret",
    label: "SIRET",
    minWidth: 160,
    render: (item) =>
      item.siret || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
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
    key: "bpf",
    label: "BPF",
    minWidth: 100,
    render: (item) =>
      item.bpf_categories_entreprise ? (
        <span className="text-xs text-muted-foreground" title={item.bpf_categories_entreprise.libelle}>
          {item.bpf_categories_entreprise.code}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
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

export default function FinanceursPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Financeur[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  // Form state
  const [formNom, setFormNom] = React.useState("");
  const [formType, setFormType] = React.useState("");
  const [formSiret, setFormSiret] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formTelephone, setFormTelephone] = React.useState("");

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
    const result = await getFinanceurs(page, debouncedSearch, showArchived, sortBy, sortDir);
    setData(result.data as Financeur[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch, showArchived, sortBy, sortDir]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormNom("");
    setFormType("");
    setFormSiret("");
    setFormEmail("");
    setFormTelephone("");
    setFormError(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    setFormError(null);

    const result = await createFinanceur({
      nom: formNom,
      type: formType as (typeof FINANCEUR_TYPES)[number] | "",
      siret: formSiret,
      email: formEmail,
      telephone: formTelephone,
    });

    setSaving(false);

    if (result.error) {
      const errors = result.error;
      if ("_form" in errors && Array.isArray(errors._form)) {
        setFormError(errors._form[0] ?? "Erreur inconnue");
      } else if ("nom" in errors && Array.isArray(errors.nom)) {
        setFormError(errors.nom[0] ?? "Le nom est requis");
      } else {
        setFormError("Erreur lors de la création");
      }
      return;
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
    toast({
      title: "Financeur créé",
      description: "Le financeur a été ajouté avec succès.",
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
        title="Financeurs"
        tableId="financeurs"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onImport={() => setImportOpen(true)}
        onAdd={() => {
          resetForm();
          setDialogOpen(true);
        }}
        addLabel="Ajouter un financeur"
        onRowClick={(item) => router.push(`/financeurs/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="financeurs"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveFinanceur(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} élément(s) archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveFinanceur(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} élément(s) restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteFinanceurs(ids);
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
            <DialogTitle>Ajouter un financeur</DialogTitle>
            <DialogDescription>
              Créez un nouveau financeur (OPCO, Pôle Emploi, Région, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {formError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nom" className="text-[13px]">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex: OPCO Atlas"
                className="h-9 text-[13px] border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-[13px]">
                Type
              </Label>
              <select
                id="type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
              >
                <option value="">-- Sélectionner --</option>
                {FINANCEUR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret" className="text-[13px]">
                SIRET
              </Label>
              <Input
                id="siret"
                value={formSiret}
                onChange={(e) => setFormSiret(e.target.value)}
                placeholder="Ex: 123 456 789 00012"
                className="h-9 text-[13px] border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@opco.fr"
                  className="h-9 text-[13px] border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone" className="text-[13px]">
                  Téléphone
                </Label>
                <Input
                  id="telephone"
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="01 23 45 67 89"
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
              disabled={saving || !formNom.trim()}
              className="h-8 text-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le financeur"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des financeurs"
        description="Importez vos financeurs depuis un fichier CSV, Excel ou JSON."
        columns={FINANCEUR_IMPORT_COLUMNS}
        onImport={async (rows) => {
          const result = await importFinanceurs(rows as Parameters<typeof importFinanceurs>[0]);
          await fetchData();
          return result;
        }}
        templateFilename="modele-financeurs"
      />
    </>
  );
}
