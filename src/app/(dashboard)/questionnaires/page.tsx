"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Copy, FileText, FileUp, Sparkles, Upload } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
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
  getQuestionnaires,
  createQuestionnaire,
  deleteQuestionnaires,
  duplicateQuestionnaire,
  createQuestionnaireFromPDF,
  generateQuestionnaireFromPrompt,
  type CreateQuestionnaireInput,
} from "@/actions/questionnaires";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface Questionnaire {
  id: string;
  nom: string;
  type: string;
  public_cible: string | null;
  statut: string;
  is_default: boolean;
  created_at: string;
  produits_formation: { intitule: string } | null;
  questionnaire_questions: { id: string }[];
  questionnaire_reponses: { id: string }[];
}

const TYPE_LABELS: Record<string, string> = {
  satisfaction_chaud: "Satisfaction à chaud",
  satisfaction_froid: "Satisfaction à froid",
  pedagogique_pre: "Péda. pré-formation",
  pedagogique_post: "Péda. post-formation",
  standalone: "Standalone",
};

const TYPE_COLORS: Record<string, string> = {
  satisfaction_chaud: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  satisfaction_froid: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pedagogique_pre: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pedagogique_post: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  standalone: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  actif: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

const PUBLIC_LABELS: Record<string, string> = {
  apprenant: "Apprenant",
  contact_client: "Contact client",
  financeur: "Financeur",
  formateur: "Formateur",
};

// ─── Columns ─────────────────────────────────────────────

const columns: Column<Questionnaire>[] = [
  {
    key: "nom",
    label: "Nom",
    sortable: true,
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <ClipboardList className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <span className="font-medium truncate block">{item.nom}</span>
          {item.produits_formation && (
            <span className="text-xs text-muted-foreground/60 truncate block">
              {item.produits_formation.intitule}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    key: "type",
    label: "Type",
    sortable: true,
    minWidth: 180,
    render: (item) => (
      <Badge variant="outline" className={`text-xs ${TYPE_COLORS[item.type] ?? ""}`}>
        {TYPE_LABELS[item.type] ?? item.type}
      </Badge>
    ),
  },
  {
    key: "public_cible",
    label: "Public",
    minWidth: 120,
    render: (item) =>
      item.public_cible ? (
        <span className="text-sm">{PUBLIC_LABELS[item.public_cible] ?? item.public_cible}</span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "statut",
    label: "Statut",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <Badge variant="outline" className={`text-xs ${STATUT_COLORS[item.statut] ?? ""}`}>
        {item.statut === "brouillon" ? "Brouillon" : item.statut === "actif" ? "Actif" : "Archivé"}
      </Badge>
    ),
  },
  {
    key: "questions",
    label: "Questions",
    minWidth: 80,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.questionnaire_questions?.length ?? 0}
      </span>
    ),
  },
  {
    key: "reponses",
    label: "Réponses",
    minWidth: 80,
    render: (item) => (
      <span className="text-sm text-muted-foreground">
        {item.questionnaire_reponses?.length ?? 0}
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

// ─── Page ────────────────────────────────────────────────

export default function QuestionnairesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Questionnaire[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = React.useState(false);
  const [promptDialogOpen, setPromptDialogOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

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
      const result = await getQuestionnaires(page, debouncedSearch, sortBy, sortDir);
      setData(result.data as Questionnaire[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortDir]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    setDialogOpen(false);
    fetchData();
    toast({ title: "Questionnaire créé", description: "Le questionnaire a été créé avec succès.", variant: "success" });
  };

  const handleAISuccess = (id: string, nom: string) => {
    setPdfDialogOpen(false);
    setPromptDialogOpen(false);
    fetchData();
    toast({
      title: "Questionnaire généré par IA",
      description: `"${nom}" a été créé. Vous pouvez le modifier avant activation.`,
      variant: "success",
    });
    router.push(`/questionnaires/${id}`);
  };

  return (
    <>
      <DataTable
        title="Questionnaires"
        tableId="questionnaires"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Créer"
        onImport={() => setPdfDialogOpen(true)}
        onRowClick={(item) => router.push(`/questionnaires/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="questionnaires"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={(key, dir) => { setSortBy(key); setSortDir(dir); setPage(1); }}
        onDelete={async (ids) => {
          const result = await deleteQuestionnaires(ids);
          if (result.error) {
            toast({ title: "Erreur", description: String(result.error), variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} questionnaire(s) supprimé(s).`, variant: "success" });
        }}
        headerExtra={
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setPromptDialogOpen(true)}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            <span className="hidden sm:inline">Générer par IA</span>
          </Button>
        }
      />

      {/* Dialog: Création manuelle */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Créer un questionnaire</DialogTitle>
            <DialogDescription>
              Choisissez le type et le public cible de votre questionnaire.
            </DialogDescription>
          </DialogHeader>
          <CreateQuestionnaireForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Import PDF IA */}
      <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              Importer un questionnaire depuis un PDF
            </DialogTitle>
            <DialogDescription>
              Uploadez un PDF contenant un questionnaire (enquête de satisfaction, évaluation pédagogique...). L&apos;IA extraira automatiquement les questions.
            </DialogDescription>
          </DialogHeader>
          <PDFImportForm
            onSuccess={handleAISuccess}
            onCancel={() => setPdfDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: Générer par IA (prompt) */}
      <Dialog open={promptDialogOpen} onOpenChange={setPromptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Générer un questionnaire par IA
            </DialogTitle>
            <DialogDescription>
              Décrivez le questionnaire souhaité et l&apos;IA le générera automatiquement avec les questions adaptées.
            </DialogDescription>
          </DialogHeader>
          <PromptGenerateForm
            onSuccess={handleAISuccess}
            onCancel={() => setPromptDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form (manual) ───────────────────────────────

function CreateQuestionnaireForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const fd = new FormData(e.currentTarget);
    const input: CreateQuestionnaireInput = {
      nom: fd.get("nom") as string,
      type: fd.get("type") as CreateQuestionnaireInput["type"],
      public_cible: (fd.get("public_cible") as CreateQuestionnaireInput["public_cible"]) || undefined,
      introduction: (fd.get("introduction") as string) || undefined,
      statut: "brouillon",
      relances_auto: true,
      is_default: false,
    };

    const result = await createQuestionnaire(input);
    setIsSubmitting(false);

    if (result.error) {
      setErrors(result.error as Record<string, string[]>);
      return;
    }

    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form[0]}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-sm">
          Nom <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          name="nom"
          placeholder="Enquête de satisfaction formation..."
          className="h-9 text-sm border-border/60"
        />
        {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type" className="text-sm">
            Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="type"
            name="type"
            defaultValue="satisfaction_chaud"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="satisfaction_chaud">Satisfaction à chaud</option>
            <option value="satisfaction_froid">Satisfaction à froid</option>
            <option value="pedagogique_pre">Péda. pré-formation</option>
            <option value="pedagogique_post">Péda. post-formation</option>
            <option value="standalone">Standalone</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="public_cible" className="text-sm">
            Public cible
          </Label>
          <select
            id="public_cible"
            name="public_cible"
            defaultValue="apprenant"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="">-- Tous --</option>
            <option value="apprenant">Apprenant</option>
            <option value="contact_client">Contact client</option>
            <option value="financeur">Financeur</option>
            <option value="formateur">Formateur</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="introduction" className="text-sm">
          Introduction (optionnelle)
        </Label>
        <textarea
          id="introduction"
          name="introduction"
          rows={3}
          placeholder="Merci de prendre quelques minutes pour répondre à ce questionnaire..."
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none"
        />
      </div>

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
            "Créer le questionnaire"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── PDF Import Form ────────────────────────────────────

function PDFImportForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (id: string, nom: string) => void;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Extract questions from PDF via API Route
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai/extract-questionnaire", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Erreur lors de l'extraction");
        setIsLoading(false);
        return;
      }

      // Step 2: Create questionnaire from extracted data
      const createResult = await createQuestionnaireFromPDF(result.data);

      if (createResult.error) {
        setError(createResult.error);
        setIsLoading(false);
        return;
      }

      onSuccess(createResult.data!.id, createResult.data!.nom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div
        className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          file
            ? "border-primary/40 bg-primary/5"
            : "border-border/60 hover:border-border"
        }`}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") fileRef.current?.click(); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 10 * 1024 * 1024) {
                setError("Le fichier est trop volumineux (max 10 Mo)");
                return;
              }
              setFile(f);
              setError(null);
            }
          }}
        />
        {file ? (
          <>
            <FileText className="h-8 w-8 text-primary mb-2" />
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} Mo
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-7 text-xs text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); setFile(null); }}
            >
              Changer de fichier
            </Button>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Cliquez pour sélectionner un PDF
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Questionnaire, enquête de satisfaction, évaluation... (max 10 Mo)
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 border border-primary/10">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          L&apos;IA analysera le PDF et extraira automatiquement les questions, types de réponses et options.
          <span className="text-primary font-medium ml-1">Coût : 1 crédit IA</span>
        </p>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 text-xs border-border/60"
        >
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={!file || isLoading}
          onClick={handleSubmit}
          className="h-8 text-xs"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Extraction en cours...
            </>
          ) : (
            <>
              <FileUp className="mr-1.5 h-3 w-3" />
              Extraire les questions
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ─── Prompt Generate Form ───────────────────────────────

function PromptGenerateForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (id: string, nom: string) => void;
  onCancel: () => void;
}) {
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState("");

  const handleSubmit = async () => {
    if (prompt.trim().length < 10) {
      setError("Décrivez le questionnaire souhaité (min. 10 caractères)");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await generateQuestionnaireFromPrompt(prompt);

      if (result.error) {
        setError(result.error);
        setIsLoading(false);
        return;
      }

      onSuccess(result.data!.id, result.data!.nom);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="ai-prompt" className="text-sm">
          Décrivez le questionnaire souhaité
        </Label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          placeholder={`Ex: Créer un questionnaire de satisfaction à chaud pour une formation en management de 2 jours, 10 questions variées couvrant la pédagogie, le contenu, le formateur et la logistique`}
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none"
          disabled={isLoading}
        />
        <p className="text-xs text-muted-foreground/60">
          Précisez le type (satisfaction, pédagogique...), le nombre de questions, le thème et le public cible pour de meilleurs résultats.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-md bg-primary/5 px-3 py-2 border border-primary/10">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs text-muted-foreground">
          L&apos;IA générera le questionnaire complet avec des questions variées et adaptées.
          <span className="text-primary font-medium ml-1">Coût : 1 crédit IA</span>
        </p>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isLoading}
          className="h-8 text-xs border-border/60"
        >
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={prompt.trim().length < 10 || isLoading}
          onClick={handleSubmit}
          className="h-8 text-xs"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3 w-3" />
              Générer (1 crédit)
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}
