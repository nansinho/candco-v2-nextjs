"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Globe, Clock } from "lucide-react";
import { DataTable, type Column, type ActiveFilter } from "@/components/data-table/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { getProduits, createProduit, archiveProduit, unarchiveProduit, deleteProduits, importProduits, type CreateProduitInput } from "@/actions/produits";
import { CsvImport, type ImportColumn } from "@/components/shared/csv-import";
import { formatDate } from "@/lib/utils";

const PRODUIT_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "intitule", label: "Intitulé", required: true, aliases: ["nom", "titre", "intitulé", "name", "title", "intitule formation", "nom formation"] },
  { key: "sous_titre", label: "Sous-titre", aliases: ["subtitle", "sous titre", "sous-titre"] },
  { key: "description", label: "Description", aliases: ["desc", "résumé", "resume", "detail"] },
  { key: "identifiant_interne", label: "Identifiant interne", aliases: ["id interne", "ref", "référence", "reference", "code"] },
  { key: "domaine", label: "Domaine", aliases: ["pôle", "pole", "categorie", "catégorie", "domain"] },
  { key: "type_action", label: "Type d'action", aliases: ["type", "type action", "type d action", "type de formation"] },
  { key: "modalite", label: "Modalité", aliases: ["modalité", "mode", "format"] },
  { key: "formule", label: "Formule", aliases: ["inter intra", "formule commerciale"] },
  { key: "duree_heures", label: "Durée (heures)", aliases: ["heures", "durée heures", "duree heures", "nb heures", "nombre heures", "hours"] },
  { key: "duree_jours", label: "Durée (jours)", aliases: ["jours", "durée jours", "duree jours", "nb jours", "nombre jours", "days"] },
];

interface Produit {
  id: string;
  numero_affichage: string;
  intitule: string;
  domaine: string | null;
  type_action: string | null;
  modalite: string | null;
  formule: string | null;
  duree_heures: number | null;
  duree_jours: number | null;
  publie: boolean;
  completion_pct: number;
  created_at: string;
}

const TYPE_ACTION_LABELS: Record<string, string> = {
  action_formation: "Formation",
  bilan_competences: "Bilan",
  vae: "VAE",
  apprentissage: "Apprentissage",
};

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  mixte: "Mixte",
  afest: "AFEST",
};

const FORMULE_LABELS: Record<string, string> = {
  inter: "Inter",
  intra: "Intra",
  individuel: "Individuel",
};

const columns: Column<Produit>[] = [
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
    key: "intitule",
    label: "Intitulé",
    sortable: true,
    filterType: "text",
    minWidth: 280,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <BookOpen className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-medium">{item.intitule}</span>
          {item.domaine && (
            <span className="block truncate text-[11px] text-muted-foreground/60">
              {item.domaine}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "type_action",
    label: "Type",
    minWidth: 120,
    render: (item) =>
      item.type_action ? (
        <Badge variant="outline" className="text-[11px] font-normal">
          {TYPE_ACTION_LABELS[item.type_action] ?? item.type_action}
        </Badge>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "modalite",
    label: "Modalité",
    filterType: "select",
    filterOptions: [{ label: "Présentiel", value: "Présentiel" }, { label: "Distanciel", value: "Distanciel" }, { label: "Mixte", value: "Mixte" }, { label: "AFEST", value: "AFEST" }],
    minWidth: 120,
    render: (item) =>
      item.modalite ? (
        <span className="text-[13px] text-muted-foreground">
          {MODALITE_LABELS[item.modalite] ?? item.modalite}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "formule",
    label: "Formule",
    minWidth: 100,
    render: (item) =>
      item.formule ? (
        <span className="text-[13px] text-muted-foreground">
          {FORMULE_LABELS[item.formule] ?? item.formule}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "duree_heures",
    label: "Durée",
    minWidth: 100,
    render: (item) => {
      if (item.duree_heures) {
        return (
          <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {item.duree_heures}h
          </span>
        );
      }
      return <span className="text-muted-foreground/40">--</span>;
    },
  },
  {
    key: "publie",
    label: "Statut",
    minWidth: 100,
    render: (item) =>
      item.publie ? (
        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[11px]">
          <Globe className="mr-1 h-3 w-3" />
          Publié
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[11px] text-muted-foreground/60 font-normal">
          Brouillon
        </Badge>
      ),
  },
  {
    key: "completion_pct",
    label: "Complétion",
    minWidth: 120,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted/50">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${item.completion_pct}%` }}
          />
        </div>
        <span className="text-[11px] text-muted-foreground">{item.completion_pct}%</span>
      </div>
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

export default function ProduitsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Produit[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
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
    const result = await getProduits(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
    setData(result.data as Produit[]);
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
      title: "Produit créé",
      description: "Le produit de formation a été ajouté au catalogue.",
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
        title="Produits de formation"
        tableId="produits"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onImport={() => setImportOpen(true)}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter un produit"
        onRowClick={(item) => router.push(`/produits/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="produits-formation"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveProduit(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} élément(s) archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveProduit(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} élément(s) restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteProduits(ids);
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
            <DialogTitle>Ajouter un produit de formation</DialogTitle>
            <DialogDescription>
              Renseignez les informations de base du produit. Vous pourrez compléter les détails ensuite.
            </DialogDescription>
          </DialogHeader>
          <CreateProduitForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <CsvImport
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Importer des produits de formation"
        description="Importez vos produits de formation depuis un fichier CSV, Excel ou JSON."
        columns={PRODUIT_IMPORT_COLUMNS}
        onImport={async (rows) => {
          const result = await importProduits(rows as Parameters<typeof importProduits>[0]);
          await fetchData();
          return result;
        }}
        templateFilename="modele-produits-formation"
      />
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

interface CreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateProduitForm({ onSuccess, onCancel }: CreateFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const input: CreateProduitInput = {
      intitule: fd.get("intitule") as string,
      domaine: (fd.get("domaine") as string) || "",
      type_action: (fd.get("type_action") as CreateProduitInput["type_action"]) || "",
      modalite: (fd.get("modalite") as CreateProduitInput["modalite"]) || "",
      formule: (fd.get("formule") as CreateProduitInput["formule"]) || "",
      duree_heures: fd.get("duree_heures") ? Number(fd.get("duree_heures")) : undefined,
      duree_jours: fd.get("duree_jours") ? Number(fd.get("duree_jours")) : undefined,
    };

    const result = await createProduit(input);

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

      <div className="space-y-2">
        <Label htmlFor="intitule" className="text-[13px]">
          Intitulé <span className="text-destructive">*</span>
        </Label>
        <Input
          id="intitule"
          name="intitule"
          required
          placeholder="Ex: Formation React avancé"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.intitule && (
          <p className="text-xs text-destructive">{errors.intitule[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="domaine" className="text-[13px]">
          Domaine / Pôle
        </Label>
        <Input
          id="domaine"
          name="domaine"
          placeholder="Ex: Développement web"
          className="h-9 text-[13px] border-border/60"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type_action" className="text-[13px]">
            Type d&apos;action
          </Label>
          <select
            id="type_action"
            name="type_action"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
          >
            <option value="">--</option>
            <option value="action_formation">Action de formation</option>
            <option value="bilan_competences">Bilan de compétences</option>
            <option value="vae">VAE</option>
            <option value="apprentissage">Apprentissage</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="modalite" className="text-[13px]">
            Modalité
          </Label>
          <select
            id="modalite"
            name="modalite"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
          >
            <option value="">--</option>
            <option value="presentiel">Présentiel</option>
            <option value="distanciel">Distanciel</option>
            <option value="mixte">Mixte</option>
            <option value="afest">AFEST</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="formule" className="text-[13px]">
            Formule
          </Label>
          <select
            id="formule"
            name="formule"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
          >
            <option value="">--</option>
            <option value="inter">Inter</option>
            <option value="intra">Intra</option>
            <option value="individuel">Individuel</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="duree_heures" className="text-[13px]">
            Durée (heures)
          </Label>
          <Input
            id="duree_heures"
            name="duree_heures"
            type="number"
            step="0.5"
            min="0"
            placeholder="Ex: 14"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="duree_jours" className="text-[13px]">
            Durée (jours)
          </Label>
          <Input
            id="duree_jours"
            name="duree_jours"
            type="number"
            step="0.5"
            min="0"
            placeholder="Ex: 2"
            className="h-9 text-[13px] border-border/60"
          />
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
            "Créer le produit"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
