"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  getTaches,
  createTache,
  updateTache,
  deleteTache,
  type CreateTacheInput,
} from "@/actions/taches";
import {
  getActivites,
  createActivite,
} from "@/actions/activites";

// ─── Types ───────────────────────────────────────────────

interface Tache {
  id: string;
  titre: string;
  description: string | null;
  statut: string;
  priorite: string;
  date_echeance: string | null;
  completed_at: string | null;
  created_at: string;
}

interface Activite {
  id: string;
  contenu: string;
  created_at: string;
  utilisateurs: { prenom: string; nom: string } | null;
}

interface TachesActivitesTabProps {
  entiteType: string;
  entiteId: string;
}

// ─── Priority helpers ────────────────────────────────────

function prioriteBadgeClass(priorite: string): string {
  switch (priorite) {
    case "urgente":
      return "border-transparent bg-red-500/15 text-red-400";
    case "haute":
      return "border-transparent bg-amber-500/15 text-amber-400";
    case "normale":
      return "border-transparent bg-blue-500/15 text-blue-400";
    case "basse":
      return "border-transparent bg-gray-500/15 text-gray-400";
    default:
      return "border-transparent bg-gray-500/15 text-gray-500";
  }
}

function prioriteLabel(priorite: string): string {
  switch (priorite) {
    case "urgente":
      return "Urgente";
    case "haute":
      return "Haute";
    case "normale":
      return "Normale";
    case "basse":
      return "Basse";
    default:
      return priorite;
  }
}

function statutIcon(statut: string) {
  switch (statut) {
    case "terminee":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "en_cours":
      return <Clock className="h-4 w-4 text-blue-400" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

// ─── Main Component ──────────────────────────────────────

export function TachesActivitesTab({ entiteType, entiteId }: TachesActivitesTabProps) {
  const { toast } = useToast();

  // ── Taches state ──
  const [taches, setTaches] = React.useState<Tache[]>([]);
  const [tachesLoading, setTachesLoading] = React.useState(true);
  const [showTacheForm, setShowTacheForm] = React.useState(false);
  const [tacheSubmitting, setTacheSubmitting] = React.useState(false);
  const [tacheTitre, setTacheTitre] = React.useState("");
  const [tachePriorite, setTachePriorite] = React.useState<string>("normale");
  const [tacheEcheance, setTacheEcheance] = React.useState("");

  // ── Activites state ──
  const [activites, setActivites] = React.useState<Activite[]>([]);
  const [activitesLoading, setActivitesLoading] = React.useState(true);
  const [noteContent, setNoteContent] = React.useState("");
  const [noteSubmitting, setNoteSubmitting] = React.useState(false);

  // ── Fetch ──
  const fetchTaches = React.useCallback(async () => {
    setTachesLoading(true);
    const result = await getTaches(entiteType, entiteId);
    setTaches(result.data as Tache[]);
    setTachesLoading(false);
  }, [entiteType, entiteId]);

  const fetchActivites = React.useCallback(async () => {
    setActivitesLoading(true);
    const result = await getActivites(entiteType, entiteId);
    setActivites(result.data as Activite[]);
    setActivitesLoading(false);
  }, [entiteType, entiteId]);

  React.useEffect(() => {
    fetchTaches();
    fetchActivites();
  }, [fetchTaches, fetchActivites]);

  // ── Tache handlers ──
  const handleCreateTache = async () => {
    if (!tacheTitre.trim()) return;
    setTacheSubmitting(true);

    const input: CreateTacheInput = {
      titre: tacheTitre,
      priorite: tachePriorite as "basse" | "normale" | "haute" | "urgente",
      date_echeance: tacheEcheance,
      entite_type: entiteType,
      entite_id: entiteId,
    };

    const result = await createTache(input);
    setTacheSubmitting(false);

    if (result.error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche.",
        variant: "destructive",
      });
      return;
    }

    setTacheTitre("");
    setTachePriorite("normale");
    setTacheEcheance("");
    setShowTacheForm(false);
    fetchTaches();
    toast({ title: "Tâche créée", variant: "success" });
  };

  const handleToggleTache = async (tache: Tache) => {
    const newStatut = tache.statut === "terminee" ? "a_faire" : "terminee";
    await updateTache(tache.id, { statut: newStatut });
    fetchTaches();
  };

  const handleDeleteTache = async (id: string) => {
    await deleteTache(id);
    fetchTaches();
    toast({ title: "Tâche supprimée", variant: "success" });
  };

  // ── Activite handlers ──
  const handleCreateNote = async () => {
    if (!noteContent.trim()) return;
    setNoteSubmitting(true);

    const result = await createActivite({
      contenu: noteContent,
      entite_type: entiteType,
      entite_id: entiteId,
    });

    setNoteSubmitting(false);

    if (result.error) {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la note.",
        variant: "destructive",
      });
      return;
    }

    setNoteContent("");
    fetchActivites();
    toast({ title: "Note ajoutée", variant: "success" });
  };

  // ── Pending taches (not completed) ──
  const pendingTaches = taches.filter((t) => t.statut !== "terminee");
  const completedTaches = taches.filter((t) => t.statut === "terminee");

  return (
    <div className="space-y-6">
      {/* ─── Taches Section ─── */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">
            Tâches
            {pendingTaches.length > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">
                {pendingTaches.length}
              </span>
            )}
          </h3>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] border-border/60"
            onClick={() => setShowTacheForm(!showTacheForm)}
          >
            <Plus className="mr-1 h-3 w-3" />
            Ajouter une tâche
          </Button>
        </div>

        {/* Create tache form */}
        {showTacheForm && (
          <div className="mb-4 rounded-md border border-border/40 bg-muted/20 p-3 space-y-3">
            <div className="space-y-2">
              <Label className="text-[13px]">
                Titre <span className="text-destructive">*</span>
              </Label>
              <Input
                value={tacheTitre}
                onChange={(e) => setTacheTitre(e.target.value)}
                placeholder="Ex: Relancer le contact"
                className="h-8 text-[13px] border-border/60"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[13px]">Priorité</Label>
                <select
                  value={tachePriorite}
                  onChange={(e) => setTachePriorite(e.target.value)}
                  className="h-8 w-full rounded-md border border-border/60 bg-transparent px-3 text-[13px] text-foreground"
                >
                  <option value="basse">Basse</option>
                  <option value="normale">Normale</option>
                  <option value="haute">Haute</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[13px]">Échéance</Label>
                <Input
                  type="date"
                  value={tacheEcheance}
                  onChange={(e) => setTacheEcheance(e.target.value)}
                  className="h-8 text-[13px] border-border/60"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => setShowTacheForm(false)}
              >
                Annuler
              </Button>
              <Button
                size="sm"
                className="h-7 text-[11px]"
                onClick={handleCreateTache}
                disabled={tacheSubmitting || !tacheTitre.trim()}
              >
                {tacheSubmitting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-3 w-3" />
                )}
                Créer
              </Button>
            </div>
          </div>
        )}

        {/* Taches list */}
        {tachesLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted/30" />
            ))}
          </div>
        ) : taches.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <CheckCircle2 className="h-8 w-8 text-muted-foreground/20" />
            <p className="mt-2 text-sm text-muted-foreground/50">
              Aucune tâche pour le moment
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Pending tasks */}
            {pendingTaches.map((tache) => (
              <TacheRow
                key={tache.id}
                tache={tache}
                onToggle={() => handleToggleTache(tache)}
                onDelete={() => handleDeleteTache(tache.id)}
              />
            ))}

            {/* Completed tasks */}
            {completedTaches.length > 0 && (
              <>
                <div className="pt-2 pb-1">
                  <p className="text-[11px] font-medium text-muted-foreground/40 uppercase tracking-wider">
                    Terminées ({completedTaches.length})
                  </p>
                </div>
                {completedTaches.map((tache) => (
                  <TacheRow
                    key={tache.id}
                    tache={tache}
                    onToggle={() => handleToggleTache(tache)}
                    onDelete={() => handleDeleteTache(tache.id)}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* ─── Activites / Journal Section ─── */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Historique d&apos;activités</h3>
        </div>

        {/* Add note */}
        <div className="mb-4 flex gap-2">
          <Input
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Ajouter une note..."
            className="h-8 text-[13px] border-border/60"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleCreateNote();
              }
            }}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[11px] border-border/60 shrink-0"
            onClick={handleCreateNote}
            disabled={noteSubmitting || !noteContent.trim()}
          >
            {noteSubmitting ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <MessageSquarePlus className="mr-1 h-3 w-3" />
            )}
            Ajouter
          </Button>
        </div>

        {/* Activites list */}
        {activitesLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted/30" />
            ))}
          </div>
        ) : activites.length === 0 ? (
          <div className="flex flex-col items-center py-8">
            <MessageSquarePlus className="h-8 w-8 text-muted-foreground/20" />
            <p className="mt-2 text-sm text-muted-foreground/50">
              Aucune activité enregistrée
            </p>
          </div>
        ) : (
          <div className="space-y-0">
            {activites.map((activite, index) => (
              <ActiviteRow
                key={activite.id}
                activite={activite}
                isLast={index === activites.length - 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Tache Row ──────────────────────────────────────────

function TacheRow({
  tache,
  onToggle,
  onDelete,
}: {
  tache: Tache;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isCompleted = tache.statut === "terminee";
  const isOverdue =
    !isCompleted &&
    tache.date_echeance &&
    new Date(tache.date_echeance) < new Date();

  return (
    <div
      className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/20"
    >
      <button
        onClick={onToggle}
        className="shrink-0 transition-opacity hover:opacity-70"
        title={isCompleted ? "Marquer comme non terminée" : "Marquer comme terminée"}
      >
        {statutIcon(tache.statut)}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`text-[13px] ${
            isCompleted ? "text-muted-foreground/40 line-through" : ""
          }`}
        >
          {tache.titre}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge className={`text-[10px] px-1.5 py-0 ${prioriteBadgeClass(tache.priorite)}`}>
            {prioriteLabel(tache.priorite)}
          </Badge>
          {tache.date_echeance && (
            <span
              className={`text-[11px] ${
                isOverdue
                  ? "text-red-400"
                  : "text-muted-foreground/50"
              }`}
            >
              {isOverdue && <AlertCircle className="inline mr-0.5 h-3 w-3" />}
              {new Date(tache.date_echeance).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
        title="Supprimer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Activite Row ───────────────────────────────────────

function ActiviteRow({
  activite,
  isLast,
}: {
  activite: Activite;
  isLast: boolean;
}) {
  const auteur = activite.utilisateurs
    ? `${activite.utilisateurs.prenom} ${activite.utilisateurs.nom}`
    : "Système";

  return (
    <div className="relative flex gap-3 pb-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[7px] top-5 bottom-0 w-px bg-border/40" />
      )}

      {/* Dot */}
      <div className="mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-primary/30 bg-card" />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[13px]">{activite.contenu}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground/50">
          {auteur} &middot;{" "}
          {new Date(activite.created_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
