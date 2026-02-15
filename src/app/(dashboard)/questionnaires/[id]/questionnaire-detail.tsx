"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Send,
  BarChart3,
  ListChecks,
  Mail,
  ChevronUp,
  ChevronDown,
  Copy,
  CheckCircle2,
  Clock,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import { formatDate } from "@/lib/utils";
import {
  updateQuestionnaire,
  addQuestion,
  updateQuestion,
  removeQuestion,
  reorderQuestions,
  sendQuestionnaireInvitations,
  type UpdateQuestionnaireInput,
  type QuestionInput,
} from "@/actions/questionnaires";

// ─── Types ───────────────────────────────────────────────

interface Questionnaire {
  id: string;
  nom: string;
  type: string;
  public_cible: string | null;
  introduction: string | null;
  produit_id: string | null;
  relances_auto: boolean;
  relance_j3: boolean;
  relance_j7: boolean;
  statut: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  produits_formation: { id: string; intitule: string; numero_affichage: string } | null;
}

interface Question {
  id: string;
  questionnaire_id: string;
  ordre: number;
  texte: string;
  type: string;
  options: { label: string; value: string }[] | null;
  obligatoire: boolean;
  points: number;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  token: string;
  sent_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  relance_count: number;
  created_at: string;
}

interface Response {
  id: string;
  respondent_email: string | null;
  respondent_name: string | null;
  responses: { question_id: string; answer: unknown; score?: number }[];
  score_total: number | null;
  submitted_at: string;
  questionnaire_invitations: { email: string; nom: string | null; prenom: string | null } | null;
}

interface QuestionStat {
  questionId: string;
  texte: string;
  type: string;
  average?: number;
  distribution?: Record<string, number>;
  count: number;
}

interface Stats {
  totalInvitations: number;
  totalOpened: number;
  totalCompleted: number;
  totalResponses: number;
  avgScore: number;
  tauxReponse: number;
  questionStats: QuestionStat[];
}

// ─── Constants ───────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  satisfaction_chaud: "Satisfaction a chaud",
  satisfaction_froid: "Satisfaction a froid",
  pedagogique_pre: "Peda. pre-formation",
  pedagogique_post: "Peda. post-formation",
  standalone: "Standalone",
};

const QUESTION_TYPE_LABELS: Record<string, string> = {
  libre: "Texte libre",
  echelle: "Echelle (0-10)",
  choix_unique: "Choix unique",
  choix_multiple: "Choix multiple",
  vrai_faux: "Vrai / Faux",
};

const STATUT_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  actif: "Actif",
  archive: "Archive",
};

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  actif: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

// ─── Main Component ─────────────────────────────────────

export function QuestionnaireDetail({
  questionnaire,
  questions: initialQuestions,
  responses,
  invitations,
  stats,
}: {
  questionnaire: Questionnaire;
  questions: Question[];
  responses: Response[];
  invitations: Invitation[];
  stats: Stats | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  useBreadcrumb(questionnaire.id, questionnaire.nom);

  const [isPending, setIsPending] = React.useState(false);
  const [questions, setQuestions] = React.useState(initialQuestions);
  const [showAddQuestion, setShowAddQuestion] = React.useState(false);
  const [editingQuestion, setEditingQuestion] = React.useState<Question | null>(null);
  const [showSendDialog, setShowSendDialog] = React.useState(false);

  // ─── Save questionnaire header ───

  const handleSaveHeader = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);

    const fd = new FormData(e.currentTarget);
    const input: UpdateQuestionnaireInput = {
      nom: fd.get("nom") as string,
      type: fd.get("type") as UpdateQuestionnaireInput["type"],
      public_cible: (fd.get("public_cible") as UpdateQuestionnaireInput["public_cible"]) || undefined,
      introduction: (fd.get("introduction") as string) || undefined,
      statut: fd.get("statut") as UpdateQuestionnaireInput["statut"],
      relances_auto: fd.get("relances_auto") === "on",
      is_default: fd.get("is_default") === "on",
    };

    const result = await updateQuestionnaire(questionnaire.id, input);
    setIsPending(false);

    if (result.error) {
      toast({ title: "Erreur", description: "Impossible de sauvegarder.", variant: "destructive" });
      return;
    }

    toast({ title: "Questionnaire mis a jour", variant: "success" });
    router.refresh();
  };

  // ─── Question operations ───

  const handleAddQuestion = async (input: QuestionInput) => {
    const result = await addQuestion(questionnaire.id, { ...input, ordre: questions.length });
    if (result.error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter la question.", variant: "destructive" });
      return false;
    }
    if (result.data) {
      setQuestions((prev) => [...prev, result.data as Question]);
    }
    toast({ title: "Question ajoutee", variant: "success" });
    return true;
  };

  const handleUpdateQuestion = async (questionId: string, input: QuestionInput) => {
    const result = await updateQuestion(questionId, questionnaire.id, input);
    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return false;
    }
    if (result.data) {
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...result.data } : q)));
    }
    toast({ title: "Question modifiee", variant: "success" });
    return true;
  };

  const handleRemoveQuestion = async (questionId: string) => {
    if (!(await confirm({ title: "Supprimer cette question ?", confirmLabel: "Supprimer", variant: "destructive" }))) return;
    const result = await removeQuestion(questionId, questionnaire.id);
    if (result.error) {
      toast({ title: "Erreur", variant: "destructive" });
      return;
    }
    setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    toast({ title: "Question supprimee", variant: "success" });
  };

  const handleMoveQuestion = async (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;
    [newQuestions[index], newQuestions[targetIndex]] = [newQuestions[targetIndex], newQuestions[index]];
    setQuestions(newQuestions);
    await reorderQuestions(
      questionnaire.id,
      newQuestions.map((q) => q.id),
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.push("/questionnaires")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{questionnaire.nom}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`text-xs ${STATUT_COLORS[questionnaire.statut] ?? ""}`}>
                {STATUT_LABELS[questionnaire.statut] ?? questionnaire.statut}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {TYPE_LABELS[questionnaire.type] ?? questionnaire.type}
              </span>
              {questionnaire.produits_formation && (
                <span className="text-xs text-muted-foreground/60">
                  | {questionnaire.produits_formation.intitule}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setShowSendDialog(true)}
          >
            <Send className="mr-1.5 h-3 w-3" />
            Envoyer
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="questions">
        <TabsList className="bg-muted/50 w-full overflow-x-auto justify-start">
          <TabsTrigger value="questions" className="text-xs">
            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            Questions
            {questions.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {questions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="parametres" className="text-xs">Parametres</TabsTrigger>
          <TabsTrigger value="invitations" className="text-xs">
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Invitations
            {invitations.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {invitations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="reponses" className="text-xs">
            <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
            Reponses
            {responses.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {responses.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="statistiques" className="text-xs">Statistiques</TabsTrigger>
        </TabsList>

        {/* ═══ Questions Tab ═══ */}
        <TabsContent value="questions" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">{questions.length} question(s)</h2>
              <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingQuestion(null); setShowAddQuestion(true); }}>
                <Plus className="mr-1.5 h-3 w-3" />
                Ajouter une question
              </Button>
            </div>

            {questions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-12">
                <ListChecks className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground/60">Aucune question</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-8 text-xs"
                  onClick={() => { setEditingQuestion(null); setShowAddQuestion(true); }}
                >
                  <Plus className="mr-1.5 h-3 w-3" />
                  Ajouter la premiere question
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div
                    key={q.id}
                    className="group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 hover:border-border transition-colors"
                  >
                    <div className="flex flex-col items-center gap-1 pt-0.5">
                      <span className="text-xs font-mono text-muted-foreground/60">{i + 1}</span>
                      <button
                        className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveQuestion(i, "up")}
                        disabled={i === 0}
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-30"
                        onClick={() => handleMoveQuestion(i, "down")}
                        disabled={i === questions.length - 1}
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{q.texte}</span>
                        {q.obligatoire && (
                          <span className="text-xs text-destructive font-semibold">*</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {QUESTION_TYPE_LABELS[q.type] ?? q.type}
                        </Badge>
                        {q.points > 0 && (
                          <span className="text-xs text-muted-foreground">{q.points} pt(s)</span>
                        )}
                        {q.type === "choix_unique" || q.type === "choix_multiple" ? (
                          <span className="text-xs text-muted-foreground/60">
                            {(q.options ?? []).length} option(s)
                          </span>
                        ) : null}
                      </div>
                      {(q.type === "choix_unique" || q.type === "choix_multiple") && (q.options ?? []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(q.options ?? []).map((opt, oi) => (
                            <span key={oi} className="inline-flex items-center rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
                              {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground/60 hover:text-foreground"
                        onClick={() => { setEditingQuestion(q); setShowAddQuestion(true); }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive"
                        onClick={() => handleRemoveQuestion(q.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Parametres Tab ═══ */}
        <TabsContent value="parametres" className="mt-6">
          <form onSubmit={handleSaveHeader} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nom" className="text-sm">Nom <span className="text-destructive">*</span></Label>
                <Input id="nom" name="nom" defaultValue={questionnaire.nom} className="h-9 text-sm" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="statut" className="text-sm">Statut</Label>
                <select
                  id="statut"
                  name="statut"
                  defaultValue={questionnaire.statut}
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
                >
                  <option value="brouillon">Brouillon</option>
                  <option value="actif">Actif</option>
                  <option value="archive">Archive</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type" className="text-sm">Type</Label>
                <select
                  id="type"
                  name="type"
                  defaultValue={questionnaire.type}
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
                >
                  <option value="satisfaction_chaud">Satisfaction a chaud</option>
                  <option value="satisfaction_froid">Satisfaction a froid</option>
                  <option value="pedagogique_pre">Peda. pre-formation</option>
                  <option value="pedagogique_post">Peda. post-formation</option>
                  <option value="standalone">Standalone</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="public_cible" className="text-sm">Public cible</Label>
                <select
                  id="public_cible"
                  name="public_cible"
                  defaultValue={questionnaire.public_cible ?? ""}
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
              <Label htmlFor="introduction" className="text-sm">Introduction</Label>
              <textarea
                id="introduction"
                name="introduction"
                rows={3}
                defaultValue={questionnaire.introduction ?? ""}
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground resize-none"
              />
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="relances_auto" defaultChecked={questionnaire.relances_auto} className="h-3.5 w-3.5 rounded border-border accent-primary" />
                <span className="text-sm">Relances automatiques</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_default" defaultChecked={questionnaire.is_default} className="h-3.5 w-3.5 rounded border-border accent-primary" />
                <span className="text-sm">Questionnaire par defaut</span>
              </label>
            </div>

            {questionnaire.produits_formation && (
              <div className="rounded-lg border border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider mb-1">Produit rattache</p>
                <p className="text-sm">
                  <span className="font-mono text-xs text-muted-foreground mr-2">{questionnaire.produits_formation.numero_affichage}</span>
                  {questionnaire.produits_formation.intitule}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={isPending}>
                {isPending ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Save className="mr-1.5 h-3 w-3" />}
                Sauvegarder
              </Button>
            </div>
          </form>
        </TabsContent>

        {/* ═══ Invitations Tab ═══ */}
        <TabsContent value="invitations" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium">{invitations.length} invitation(s)</h2>
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowSendDialog(true)}>
                <Send className="mr-1.5 h-3 w-3" />
                Envoyer des invitations
              </Button>
            </div>

            {invitations.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-12">
                <Mail className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground/60">Aucune invitation envoyee</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Destinataire</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Envoye</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Ouvert</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Complete</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Relances</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <div>
                            {inv.prenom || inv.nom ? (
                              <span className="font-medium">{[inv.prenom, inv.nom].filter(Boolean).join(" ")}</span>
                            ) : null}
                            <span className="text-muted-foreground block text-xs">{inv.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {inv.sent_at ? formatDate(inv.sent_at) : "--"}
                        </td>
                        <td className="px-4 py-2.5">
                          {inv.opened_at ? (
                            <span className="text-blue-400 text-xs">{formatDate(inv.opened_at)}</span>
                          ) : (
                            <span className="text-muted-foreground/40">--</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {inv.completed_at ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              {formatDate(inv.completed_at)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted-foreground/40 text-xs">
                              <Clock className="h-3 w-3" />
                              En attente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{inv.relance_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Reponses Tab ═══ */}
        <TabsContent value="reponses" className="mt-6">
          <div className="space-y-4">
            <h2 className="text-sm font-medium">{responses.length} reponse(s)</h2>

            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-12">
                <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                <p className="mt-3 text-sm text-muted-foreground/60">Aucune reponse recue</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left">
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Repondant</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Score</th>
                      <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground/60 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {responses.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/20">
                        <td className="px-4 py-2.5">
                          <span className="font-medium">{r.respondent_name || r.respondent_email || "Anonyme"}</span>
                          {r.respondent_email && r.respondent_name && (
                            <span className="text-muted-foreground text-xs block">{r.respondent_email}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {r.score_total !== null ? (
                            <span className="font-mono font-medium">{r.score_total}</span>
                          ) : (
                            <span className="text-muted-foreground/40">--</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatDate(r.submitted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ Statistiques Tab ═══ */}
        <TabsContent value="statistiques" className="mt-6">
          {stats ? (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Invitations</p>
                  <p className="mt-1 text-2xl font-mono font-semibold">{stats.totalInvitations}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Reponses</p>
                  <p className="mt-1 text-2xl font-mono font-semibold">{stats.totalResponses}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Taux reponse</p>
                  <p className="mt-1 text-2xl font-mono font-semibold">{stats.tauxReponse}%</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
                  <p className="text-xs text-muted-foreground/60 uppercase font-semibold tracking-wider">Score moyen</p>
                  <p className="mt-1 text-2xl font-mono font-semibold">{stats.avgScore.toFixed(1)}</p>
                </div>
              </div>

              {/* Per-question stats */}
              {stats.questionStats.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Detail par question</h3>
                  {stats.questionStats.map((qs, i) => (
                    <div key={qs.questionId} className="rounded-lg border border-border/60 bg-card p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono text-muted-foreground/60">Q{i + 1}</span>
                        <span className="text-sm font-medium">{qs.texte}</span>
                        <Badge variant="outline" className="text-xs">{QUESTION_TYPE_LABELS[qs.type] ?? qs.type}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">{qs.count} reponse(s)</span>
                      </div>

                      {qs.type === "echelle" && qs.average !== undefined && (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${(qs.average / 10) * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-sm font-semibold">{qs.average.toFixed(1)}/10</span>
                        </div>
                      )}

                      {qs.distribution && Object.keys(qs.distribution).length > 0 && (
                        <div className="space-y-1.5">
                          {Object.entries(qs.distribution).map(([label, count]) => (
                            <div key={label} className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-32 truncate">{label}</span>
                              <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary/60 rounded-full"
                                  style={{ width: `${qs.count > 0 ? (count / qs.count) * 100 : 0}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-muted-foreground w-8 text-right">{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground/60">Pas encore de donnees</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Add/Edit Question Dialog ─── */}
      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingQuestion ? "Modifier la question" : "Ajouter une question"}</DialogTitle>
          </DialogHeader>
          <QuestionForm
            question={editingQuestion}
            onSave={async (input) => {
              let ok: boolean;
              if (editingQuestion) {
                ok = await handleUpdateQuestion(editingQuestion.id, input);
              } else {
                ok = await handleAddQuestion(input);
              }
              if (ok) {
                setShowAddQuestion(false);
                setEditingQuestion(null);
              }
            }}
            onCancel={() => { setShowAddQuestion(false); setEditingQuestion(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* ─── Send Invitations Dialog ─── */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Envoyer des invitations</DialogTitle>
            <DialogDescription>
              Saisissez les adresses email des destinataires (une par ligne).
            </DialogDescription>
          </DialogHeader>
          <SendInvitationsForm
            questionnaireId={questionnaire.id}
            onSuccess={(count) => {
              setShowSendDialog(false);
              toast({ title: `${count} invitation(s) envoyee(s)`, variant: "success" });
              router.refresh();
            }}
            onCancel={() => setShowSendDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}

// ─── Question Form ──────────────────────────────────────

function QuestionForm({
  question,
  onSave,
  onCancel,
}: {
  question: Question | null;
  onSave: (input: QuestionInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [type, setType] = React.useState(question?.type ?? "libre");
  const [options, setOptions] = React.useState<{ label: string; value: string }[]>(
    question?.options ?? [],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);

    const input: QuestionInput = {
      texte: fd.get("texte") as string,
      type: type as QuestionInput["type"],
      obligatoire: fd.get("obligatoire") === "on",
      points: Number(fd.get("points") ?? 0),
      ordre: question?.ordre ?? 0,
      options: (type === "choix_unique" || type === "choix_multiple") ? options : [],
    };

    await onSave(input);
    setIsSubmitting(false);
  };

  const addOption = () => {
    setOptions((prev) => [...prev, { label: "", value: "" }]);
  };

  const updateOption = (i: number, label: string) => {
    setOptions((prev) =>
      prev.map((opt, idx) => (idx === i ? { label, value: label.toLowerCase().replace(/\s+/g, "_") } : opt)),
    );
  };

  const removeOption = (i: number) => {
    setOptions((prev) => prev.filter((_, idx) => idx !== i));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="texte" className="text-sm">Question <span className="text-destructive">*</span></Label>
        <textarea
          id="texte"
          name="texte"
          rows={2}
          defaultValue={question?.texte ?? ""}
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground resize-none"
          placeholder="Etes-vous satisfait de la formation ?"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-sm">Type</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="libre">Texte libre</option>
            <option value="echelle">Echelle (0-10)</option>
            <option value="choix_unique">Choix unique</option>
            <option value="choix_multiple">Choix multiple</option>
            <option value="vrai_faux">Vrai / Faux</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="points" className="text-sm">Points</Label>
          <Input id="points" name="points" type="number" defaultValue={question?.points ?? 0} min={0} className="h-9 text-sm" />
        </div>

        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="obligatoire" defaultChecked={question?.obligatoire ?? true} className="h-3.5 w-3.5 rounded border-border accent-primary" />
            <span className="text-sm">Obligatoire</span>
          </label>
        </div>
      </div>

      {/* Options for choix_unique / choix_multiple */}
      {(type === "choix_unique" || type === "choix_multiple") && (
        <div className="space-y-2">
          <Label className="text-sm">Options de reponse</Label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={opt.label}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Option ${i + 1}`}
                className="h-8 text-sm flex-1"
              />
              <button
                type="button"
                className="p-1 text-muted-foreground/60 hover:text-destructive"
                onClick={() => removeOption(i)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addOption}>
            <Plus className="mr-1 h-3 w-3" />
            Ajouter une option
          </Button>
        </div>
      )}

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting} className="h-8 text-xs">
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : null}
          {question ? "Modifier" : "Ajouter"}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ─── Send Invitations Form ──────────────────────────────

function SendInvitationsForm({
  questionnaireId,
  onSuccess,
  onCancel,
}: {
  questionnaireId: string;
  onSuccess: (count: number) => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [emails, setEmails] = React.useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const recipients = emails
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.includes("@"))
      .map((email) => ({ email }));

    if (recipients.length === 0) {
      setIsSubmitting(false);
      return;
    }

    const result = await sendQuestionnaireInvitations(questionnaireId, recipients);
    setIsSubmitting(false);

    if (result.error) return;
    onSuccess(result.count ?? recipients.length);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="emails" className="text-sm">Adresses email (une par ligne)</Label>
        <textarea
          id="emails"
          rows={6}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-foreground font-mono resize-none"
          placeholder={"jean.dupont@email.com\nmarie.martin@email.com"}
        />
        <p className="text-xs text-muted-foreground/60">
          {emails.split("\n").filter((l) => l.trim().includes("@")).length} adresse(s) valide(s)
        </p>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isSubmitting} className="h-8 text-xs">
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Send className="mr-1.5 h-3 w-3" />}
          Envoyer
        </Button>
      </DialogFooter>
    </form>
  );
}
