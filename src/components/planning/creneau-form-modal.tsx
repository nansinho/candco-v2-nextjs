"use client";

import * as React from "react";
import { Loader2, AlertTriangle, Sun, Sunset, Calendar, Settings2 } from "lucide-react";
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
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { addCreneau, addCreneauxBatch, type CreneauInput } from "@/actions/sessions";
import { CRENEAU_PRESETS, type CreneauMode } from "@/lib/constants";
import { updateCreneau, checkCreneauConflicts, type Conflict } from "@/actions/planning";
import type { PlanningCreneau } from "@/actions/planning";

interface CreneauFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Pre-selected date (yyyy-MM-dd) for new créneaux */
  defaultDate?: string;
  /** Existing créneau for edit mode */
  editCreneau?: PlanningCreneau | null;
  /** Available sessions */
  sessions: { id: string; nom: string; numero_affichage: string; statut: string }[];
  /** Available formateurs */
  formateurs: { id: string; prenom: string; nom: string }[];
  /** Available salles */
  salles: { id: string; nom: string }[];
}

export function CreneauFormModal({
  open,
  onOpenChange,
  onSuccess,
  defaultDate,
  editCreneau,
  sessions,
  formateurs,
  salles,
}: CreneauFormModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<Conflict[]>([]);
  const [checkingConflicts, setCheckingConflicts] = React.useState(false);

  const isEdit = !!editCreneau;

  // Mode state (only for create mode)
  const [mode, setMode] = React.useState<CreneauMode>("matin");

  const handleModeChange = (newMode: CreneauMode) => {
    setMode(newMode);
    if (newMode === "matin") {
      setHeureDebut(CRENEAU_PRESETS.matin.heure_debut);
      setHeureFin(CRENEAU_PRESETS.matin.heure_fin);
    } else if (newMode === "apres_midi") {
      setHeureDebut(CRENEAU_PRESETS.apres_midi.heure_debut);
      setHeureFin(CRENEAU_PRESETS.apres_midi.heure_fin);
    } else if (newMode === "personnalise") {
      setHeureDebut("09:00");
      setHeureFin("17:00");
    }
  };

  // Form state
  const [sessionId, setSessionId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [heureDebut, setHeureDebut] = React.useState<string>(CRENEAU_PRESETS.matin.heure_debut);
  const [heureFin, setHeureFin] = React.useState<string>(CRENEAU_PRESETS.matin.heure_fin);
  const [type, setType] = React.useState<"presentiel" | "distanciel" | "elearning" | "stage">("presentiel");
  const [formateurId, setFormateurId] = React.useState("");
  const [salleId, setSalleId] = React.useState("");

  // Reset form when opening
  React.useEffect(() => {
    if (open) {
      setConflicts([]);
      if (editCreneau) {
        setSessionId(editCreneau.session_id);
        setDate(editCreneau.date);
        setHeureDebut(editCreneau.heure_debut.slice(0, 5));
        setHeureFin(editCreneau.heure_fin.slice(0, 5));
        setType(editCreneau.type as typeof type);
        setFormateurId(editCreneau.formateur_id ?? "");
        setSalleId(editCreneau.salle_id ?? "");
      } else {
        setMode("matin");
        setSessionId("");
        setDate(defaultDate ?? "");
        setHeureDebut(CRENEAU_PRESETS.matin.heure_debut);
        setHeureFin(CRENEAU_PRESETS.matin.heure_fin);
        setType("presentiel");
        setFormateurId("");
        setSalleId("");
      }
    }
  }, [open, editCreneau, defaultDate]);

  // Check conflicts when key fields change
  React.useEffect(() => {
    if (!open || !date || !heureDebut || !heureFin) {
      setConflicts([]);
      return;
    }
    if (!formateurId && !salleId) {
      setConflicts([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingConflicts(true);
      try {
        const result = await checkCreneauConflicts({
          date,
          heure_debut: heureDebut,
          heure_fin: heureFin,
          formateur_id: formateurId || undefined,
          salle_id: salleId || undefined,
          excludeCreneauId: editCreneau?.id,
        });
        setConflicts(result.conflicts);
      } catch {
        // ignore
      } finally {
        setCheckingConflicts(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [open, date, heureDebut, heureFin, formateurId, salleId, editCreneau?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (isEdit && editCreneau) {
        const result = await updateCreneau(editCreneau.id, {
          date,
          heure_debut: heureDebut,
          heure_fin: heureFin,
          type,
          formateur_id: formateurId || undefined,
          salle_id: salleId || undefined,
        }) as { error?: unknown; data?: unknown };

        if (result.error) {
          const msg = typeof result.error === "string"
            ? result.error
            : (result.error as Record<string, string[]>)._form?.[0] ?? "Erreur lors de la modification";
          toast({ variant: "destructive", title: msg });
          return;
        }

        toast({ variant: "success", title: "Creneau modifie" });
      } else {
        if (!sessionId) {
          toast({ variant: "destructive", title: "Veuillez selectionner une session" });
          return;
        }

        if (mode === "journee") {
          const inputs: CreneauInput[] = [
            { date, heure_debut: CRENEAU_PRESETS.matin.heure_debut, heure_fin: CRENEAU_PRESETS.matin.heure_fin, type, formateur_id: formateurId || undefined, salle_id: salleId || undefined },
            { date, heure_debut: CRENEAU_PRESETS.apres_midi.heure_debut, heure_fin: CRENEAU_PRESETS.apres_midi.heure_fin, type, formateur_id: formateurId || undefined, salle_id: salleId || undefined },
          ];
          const result = await addCreneauxBatch(sessionId, inputs) as { error?: unknown; data?: unknown };
          if (result.error) {
            const msg = typeof result.error === "string"
              ? result.error
              : (result.error as Record<string, string[]>)._form?.[0] ?? "Erreur lors de la creation";
            toast({ variant: "destructive", title: msg });
            return;
          }
          toast({ variant: "success", title: "2 creneaux ajoutes", description: "Matin + Apres-midi" });
        } else {
          const input: CreneauInput = {
            date,
            heure_debut: heureDebut,
            heure_fin: heureFin,
            type,
            formateur_id: formateurId || undefined,
            salle_id: salleId || undefined,
          };

          const result = await addCreneau(sessionId, input) as { error?: unknown; data?: unknown };

          if (result.error) {
            const msg = typeof result.error === "string"
              ? result.error
              : (result.error as Record<string, string[]>)._form?.[0] ?? "Erreur lors de la creation";
            toast({ variant: "destructive", title: msg });
            return;
          }

          toast({ variant: "success", title: "Creneau ajoute" });
        }
      }

      onOpenChange(false);
      onSuccess?.();
    } catch {
      toast({ variant: "destructive", title: "Erreur inattendue" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le creneau" : "Ajouter un creneau"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Modifiez les details du creneau pour ${editCreneau?.session.nom}`
              : "Ajoutez un creneau horaire a une session"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Session (only for new créneaux) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="creneau-session" className="text-xs">Session *</Label>
              <select
                id="creneau-session"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                required
              >
                <option value="">Selectionner une session...</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.numero_affichage} — {s.nom}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mode selector (create mode only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mode</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: "matin" as const, label: "Matin", icon: <Sun className="h-3.5 w-3.5" /> },
                  { value: "apres_midi" as const, label: "Après-midi", icon: <Sunset className="h-3.5 w-3.5" /> },
                  { value: "journee" as const, label: "Journée", icon: <Calendar className="h-3.5 w-3.5" /> },
                  { value: "personnalise" as const, label: "Personnalisé", icon: <Settings2 className="h-3.5 w-3.5" /> },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleModeChange(opt.value)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                      mode === opt.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="creneau-date" className="text-xs">Date *</Label>
            <Input
              id="creneau-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time range */}
          {!isEdit && mode === "journee" ? (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">2 créneaux seront créés :</span>
              <span className="ml-2">Matin {CRENEAU_PRESETS.matin.heure_debut}–{CRENEAU_PRESETS.matin.heure_fin}</span>
              <span className="mx-1.5">•</span>
              <span>Après-midi {CRENEAU_PRESETS.apres_midi.heure_debut}–{CRENEAU_PRESETS.apres_midi.heure_fin}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="creneau-debut" className="text-xs">Debut *</Label>
                <Input
                  id="creneau-debut"
                  type="time"
                  value={heureDebut}
                  onChange={(e) => setHeureDebut(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="creneau-fin" className="text-xs">Fin *</Label>
                <Input
                  id="creneau-fin"
                  type="time"
                  value={heureFin}
                  onChange={(e) => setHeureFin(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="creneau-type" className="text-xs">Type</Label>
            <select
              id="creneau-type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="presentiel">Presentiel</option>
              <option value="distanciel">Distanciel</option>
              <option value="elearning">E-learning</option>
              <option value="stage">Stage</option>
            </select>
          </div>

          {/* Formateur */}
          <div className="space-y-1.5">
            <Label htmlFor="creneau-formateur" className="text-xs">Formateur</Label>
            <select
              id="creneau-formateur"
              value={formateurId}
              onChange={(e) => setFormateurId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Aucun</option>
              {formateurs.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.prenom} {f.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Salle */}
          <div className="space-y-1.5">
            <Label htmlFor="creneau-salle" className="text-xs">Salle</Label>
            <select
              id="creneau-salle"
              value={salleId}
              onChange={(e) => setSalleId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Aucune</option>
              {salles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nom}
                </option>
              ))}
            </select>
          </div>

          {/* Conflict warnings */}
          {conflicts.length > 0 && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-medium">
                <AlertTriangle className="h-3.5 w-3.5" />
                {conflicts.length === 1 ? "1 conflit detecte" : `${conflicts.length} conflits detectes`}
              </div>
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs text-amber-400/80">
                  {c.type === "formateur" ? "Formateur" : "Salle"} &quot;{c.entityName}&quot; deja occupe(e) de{" "}
                  {c.existingCreneau.heure_debut.slice(0, 5)} a {c.existingCreneau.heure_fin.slice(0, 5)}{" "}
                  ({c.existingCreneau.sessionNom})
                </p>
              ))}
            </div>
          )}

          {checkingConflicts && (
            <p className="text-xs text-muted-foreground-subtle flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Verification des conflits...
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
            >
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {isEdit ? "Modifier" : mode === "journee" ? "Ajouter 2 créneaux" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
