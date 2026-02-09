"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Loader2, Copy, FileText } from "lucide-react";
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
            <span className="text-[11px] text-muted-foreground/50 truncate block">
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
      <Badge variant="outline" className={`text-[11px] ${TYPE_COLORS[item.type] ?? ""}`}>
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
        <span className="text-[13px]">{PUBLIC_LABELS[item.public_cible] ?? item.public_cible}</span>
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
      <Badge variant="outline" className={`text-[11px] ${STATUT_COLORS[item.statut] ?? ""}`}>
        {item.statut === "brouillon" ? "Brouillon" : item.statut === "actif" ? "Actif" : "Archivé"}
      </Badge>
    ),
  },
  {
    key: "questions",
    label: "Questions",
    minWidth: 80,
    render: (item) => (
      <span className="text-[13px] text-muted-foreground">
        {item.questionnaire_questions?.length ?? 0}
      </span>
    ),
  },
  {
    key: "reponses",
    label: "Réponses",
    minWidth: 80,
    render: (item) => (
      <span className="text-[13px] text-muted-foreground">
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
        addLabel="Créer un questionnaire"
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
      />

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
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

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
        <Label htmlFor="nom" className="text-[13px]">
          Nom <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          name="nom"
          placeholder="Enquête de satisfaction formation..."
          className="h-9 text-[13px] border-border/60"
        />
        {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="type" className="text-[13px]">
            Type <span className="text-destructive">*</span>
          </Label>
          <select
            id="type"
            name="type"
            defaultValue="satisfaction_chaud"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
          >
            <option value="satisfaction_chaud">Satisfaction à chaud</option>
            <option value="satisfaction_froid">Satisfaction à froid</option>
            <option value="pedagogique_pre">Péda. pré-formation</option>
            <option value="pedagogique_post">Péda. post-formation</option>
            <option value="standalone">Standalone</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="public_cible" className="text-[13px]">
            Public cible
          </Label>
          <select
            id="public_cible"
            name="public_cible"
            defaultValue="apprenant"
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-[13px] text-foreground"
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
        <Label htmlFor="introduction" className="text-[13px]">
          Introduction (optionnelle)
        </Label>
        <textarea
          id="introduction"
          name="introduction"
          rows={3}
          placeholder="Merci de prendre quelques minutes pour répondre à ce questionnaire..."
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 resize-none"
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
