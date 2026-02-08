"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2, Globe, Clock, Upload, Sparkles, AlertCircle, CheckCircle2, FileText } from "lucide-react";
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
import { getProduits, createProduit, createProduitFromPDF, archiveProduit, unarchiveProduit, deleteProduits, importProduits, type CreateProduitInput } from "@/actions/produits";
import { formatDate } from "@/lib/utils";

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
  organise_par_nom: string | null;
  organise_par_logo_url: string | null;
  organise_par_actif: boolean;
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
    key: "organise_par_nom",
    label: "Organisé par",
    minWidth: 140,
    defaultVisible: false,
    render: (item: Produit) =>
      item.organise_par_actif && item.organise_par_nom ? (
        <div className="flex items-center gap-2">
          {item.organise_par_logo_url ? (
            <img src={item.organise_par_logo_url} alt="" className="h-5 w-5 rounded object-contain bg-white shrink-0" />
          ) : null}
          <span className="text-[12px] truncate max-w-[120px]">{item.organise_par_nom}</span>
        </div>
      ) : (
        <span className="text-muted-foreground/40 text-[11px]">—</span>
      ),
  },
  {
    key: "completion_pct",
    label: "Complétion",
    minWidth: 120,
    render: (item: Produit) => (
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
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);

  // Import dialog state
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [isPdfImporting, setIsPdfImporting] = React.useState(false);
  const [isJsonImporting, setIsJsonImporting] = React.useState(false);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [importResult, setImportResult] = React.useState<{ success: number; errors: string[] } | null>(null);
  const [jsonRows, setJsonRows] = React.useState<Record<string, string>[] | null>(null);
  const importFileRef = React.useRef<HTMLInputElement>(null);

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
      const result = await getProduits(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as Produit[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = (produitId?: string) => {
    setDialogOpen(false);
    toast({
      title: "Formation créée",
      description: "La formation a été ajoutée au catalogue.",
      variant: "success",
    });
    if (produitId) {
      router.push(`/produits/${produitId}`);
    } else {
      fetchData();
    }
  };

  const handlePdfImport = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/ai/extract-programme", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
      throw new Error(result.error);
    }

    // Create the full product from extracted data
    const createResult = await createProduitFromPDF(result.data);

    if (createResult.error) {
      const msg = typeof createResult.error === "string" ? createResult.error : "Erreur lors de la creation";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
      throw new Error(msg);
    }

    toast({
      title: "Formation créée depuis le PDF",
      description: `"${createResult.data?.intitule}" a été créée avec toutes les informations extraites.`,
      variant: "success",
    });

    setDialogOpen(false);

    // Navigate to the created product
    if (createResult.data?.id) {
      router.push(`/produits/${createResult.data.id}`);
    } else {
      fetchData();
    }
  };

  const resetImport = () => {
    setImportFile(null);
    setIsPdfImporting(false);
    setIsJsonImporting(false);
    setImportError(null);
    setImportResult(null);
    setJsonRows(null);
    if (importFileRef.current) importFileRef.current.value = "";
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setImportFile(f);
    setImportError(null);
    setImportResult(null);
    setJsonRows(null);

    if (/\.pdf$/i.test(f.name)) {
      setIsPdfImporting(true);
      try {
        await handlePdfImport(f);
      } catch {
        setImportError("Erreur lors de l'import IA du PDF.");
      } finally {
        setIsPdfImporting(false);
      }
    } else if (/\.json$/i.test(f.name)) {
      try {
        const text = await f.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data) || data.length === 0) {
          setImportError("Le fichier JSON doit contenir un tableau d'objets.");
          return;
        }
        const rows = (data as Record<string, unknown>[]).map((item) => {
          const row: Record<string, string> = {};
          for (const [key, val] of Object.entries(item)) {
            row[key] = val != null ? String(val) : "";
          }
          return row;
        });
        const valid = rows.filter((r) => r.intitule?.trim());
        if (valid.length === 0) {
          setImportError("Aucun produit avec un intitulé trouvé dans le fichier.");
          return;
        }
        setJsonRows(valid);
      } catch {
        setImportError("Fichier JSON invalide.");
      }
    } else {
      setImportError("Format non supporté. Utilisez un fichier PDF ou JSON.");
    }
  };

  const handleJsonImportSubmit = async () => {
    if (!jsonRows) return;
    setIsJsonImporting(true);
    try {
      const result = await importProduits(jsonRows as Parameters<typeof importProduits>[0]);
      setImportResult(result);
      await fetchData();
    } catch {
      setImportResult({ success: 0, errors: ["Erreur lors de l'import."] });
    } finally {
      setIsJsonImporting(false);
    }
  };

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  return (
    <>
      <DataTable
        title="Catalogue de formation"
        tableId="produits"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onImport={() => setDialogOpen(true)}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter une formation"
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

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetImport(); setDialogOpen(o); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une formation</DialogTitle>
            <DialogDescription>
              Créez manuellement ou importez depuis un PDF via l&apos;IA.
            </DialogDescription>
          </DialogHeader>

          {/* ─── Import IA zone ─────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md bg-primary/5 px-3 py-2.5 border border-primary/20">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                <strong className="text-primary">Import IA :</strong> Uploadez un PDF et l&apos;IA remplit automatiquement tous les champs (programme, objectifs, tarifs, prérequis...).
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={importFileRef}
                type="file"
                accept=".pdf,.json"
                onChange={handleImportFileChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => importFileRef.current?.click()}
                disabled={isPdfImporting}
                className="flex-1 h-10 border-dashed border-2 border-border/40 hover:border-primary/30 text-xs"
              >
                {importFile ? (
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-medium truncate max-w-[200px]">{importFile.name}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    Importer un PDF (IA)
                  </span>
                )}
              </Button>
            </div>

            {isPdfImporting && (
              <div className="flex flex-col items-center gap-3 py-4">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Analyse IA du PDF en cours...</p>
              </div>
            )}

            {jsonRows && !importResult && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2 border border-emerald-500/20">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-400">
                  <strong>{jsonRows.length}</strong> produit(s) trouvé(s) dans le fichier JSON
                </p>
              </div>
            )}

            {importError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">{importError}</p>
              </div>
            )}

            {importResult && (
              <div className="space-y-2">
                {importResult.success > 0 && (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-400">{importResult.success} produit(s) importé(s).</p>
                  </div>
                )}
                {importResult.errors.length > 0 && (
                  <div className="space-y-1 rounded-md bg-destructive/10 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                      <p className="text-xs text-destructive font-medium">{importResult.errors.length} erreur(s)</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {jsonRows && !importResult && (
              <Button type="button" size="sm" onClick={handleJsonImportSubmit} disabled={isJsonImporting} className="w-full h-8 text-xs">
                {isJsonImporting ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Import en cours...</> : `Importer (${jsonRows.length})`}
              </Button>
            )}
          </div>

          {/* ─── Separator ──────────────────────────────── */}
          {!isPdfImporting && !importResult && (
            <>
              <div className="relative my-1">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                <div className="relative flex justify-center"><span className="bg-card px-3 text-[11px] text-muted-foreground/60 uppercase tracking-wider">ou créer manuellement</span></div>
              </div>

              {/* ─── Manual create form ──────────────────── */}
              <CreateProduitForm
                onSuccess={handleCreateSuccess}
                onCancel={() => setDialogOpen(false)}
              />
            </>
          )}

          {(isPdfImporting || importResult) && (
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => { resetImport(); setDialogOpen(false); }} className="h-8 text-xs border-border/60">
                {importResult ? "Fermer" : "Annuler"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

interface CreateFormProps {
  onSuccess: (produitId?: string) => void;
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
    onSuccess(result.data?.id);
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
            "Créer la formation"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
