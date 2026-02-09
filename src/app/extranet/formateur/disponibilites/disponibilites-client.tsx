"use client";

import * as React from "react";
import { Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getFormateurDisponibilites,
  addDisponibilite,
  removeDisponibilite,
  type Disponibilite,
} from "@/actions/disponibilites";
import {
  format,
  getWeekDays,
  getWeekRange,
  formatDayHeader,
  formatWeekLabel,
  isToday,
  isWeekend,
  parseTime,
  HOURS,
  HOUR_START,
  HOUR_HEIGHT_PX,
} from "@/components/planning/calendar-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addWeeks, subWeeks } from "date-fns";

// ─── Color config ───────────────────────────────────────

const DISPO_COLORS: Record<string, { bg: string; border: string; text: string; label: string; icon: React.ElementType }> = {
  disponible: { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", label: "Disponible", icon: CheckCircle },
  indisponible: { bg: "bg-red-500/15", border: "border-red-500/30", text: "text-red-400", label: "Indisponible", icon: XCircle },
  sous_reserve: { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", label: "Sous reserve", icon: AlertCircle },
};

// ─── Main component ─────────────────────────────────────

interface DisponibilitesClientProps {
  formateurId: string;
  organisationId: string;
}

export function DisponibilitesClient({ formateurId, organisationId }: DisponibilitesClientProps) {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [loading, setLoading] = React.useState(true);
  const [disponibilites, setDisponibilites] = React.useState<Disponibilite[]>([]);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [defaultDate, setDefaultDate] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Form state
  const [formDate, setFormDate] = React.useState("");
  const [formDebut, setFormDebut] = React.useState("09:00");
  const [formFin, setFormFin] = React.useState("17:00");
  const [formType, setFormType] = React.useState<"disponible" | "indisponible" | "sous_reserve">("disponible");
  const [formNote, setFormNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Fetch dispos
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const range = getWeekRange(currentDate);
    getFormateurDisponibilites(
      formateurId,
      format(range.start, "yyyy-MM-dd"),
      format(range.end, "yyyy-MM-dd")
    ).then((result) => {
      if (cancelled) return;
      setDisponibilites(result.data);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [formateurId, currentDate]);

  // Auto-scroll
  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOUR_START) * HOUR_HEIGHT_PX - 20;
    }
  }, []);

  const openAddModal = (date?: string) => {
    setFormDate(date ?? format(new Date(), "yyyy-MM-dd"));
    setFormDebut("09:00");
    setFormFin("17:00");
    setFormType("disponible");
    setFormNote("");
    setModalOpen(true);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await addDisponibilite({
        formateur_id: formateurId,
        date: formDate,
        heure_debut: formDebut,
        heure_fin: formFin,
        type: formType,
        recurrence: "aucune",
        note: formNote,
      });

      if (result.error) {
        toast({ variant: "destructive", title: "Erreur lors de l'ajout" });
        return;
      }

      toast({ variant: "success", title: "Disponibilite ajoutee" });
      setModalOpen(false);

      // Refresh
      const range = getWeekRange(currentDate);
      const refreshed = await getFormateurDisponibilites(
        formateurId,
        format(range.start, "yyyy-MM-dd"),
        format(range.end, "yyyy-MM-dd")
      );
      setDisponibilites(refreshed.data);
    } catch {
      toast({ variant: "destructive", title: "Erreur inattendue" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dispo: Disponibilite) => {
    if (!confirm("Supprimer cette disponibilite ?")) return;

    const result = await removeDisponibilite(dispo.id);
    if (result.error) {
      toast({ variant: "destructive", title: typeof result.error === "string" ? result.error : "Erreur" });
      return;
    }

    toast({ variant: "success", title: "Disponibilite supprimee" });
    setDisponibilites((prev) => prev.filter((d) => d.id !== dispo.id));
  };

  const days = getWeekDays(currentDate);
  const dispoByDay = React.useMemo(() => {
    const map = new Map<string, Disponibilite[]>();
    for (const d of disponibilites) {
      if (!map.has(d.date)) map.set(d.date, []);
      map.get(d.date)!.push(d);
    }
    return map;
  }, [disponibilites]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(DISPO_COLORS).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <div className={cn("h-2.5 w-2.5 rounded-sm", config.bg, `border ${config.border}`)} />
            {config.label}
          </div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>
          Aujourd&apos;hui
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize flex-1">{formatWeekLabel(currentDate)}</span>
        <Button size="sm" className="h-8 text-xs" onClick={() => openAddModal()}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Disponibilite
        </Button>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0 rounded-lg border border-border/60 bg-card overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 animate-pulse p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 rounded bg-muted/15" style={{ opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        ) : (
          <>
            {/* Day headers */}
            <div className="flex border-b border-border/60 bg-card/80 backdrop-blur-sm sticky top-0 z-10">
              <div className="w-14 shrink-0 border-r border-border/40" />
              <div className="flex-1 grid grid-cols-7">
                {days.map((day) => {
                  const { dayName, dayNum } = formatDayHeader(day);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "flex flex-col items-center py-2 border-r border-border/20 last:border-r-0 cursor-pointer hover:bg-primary/5 transition-colors",
                        today && "bg-primary/5"
                      )}
                      onClick={() => openAddModal(format(day, "yyyy-MM-dd"))}
                    >
                      <span className={cn("text-[11px] uppercase tracking-wider font-medium", today ? "text-primary" : "text-muted-foreground/60")}>
                        {dayName}
                      </span>
                      <span className={cn("mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold", today ? "bg-primary text-primary-foreground" : "text-foreground")}>
                        {dayNum}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
              <div className="flex min-h-full">
                <div className="w-14 shrink-0 border-r border-border/40 relative">
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono"
                      style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }}
                    >
                      {String(hour).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                <div className="flex-1 grid grid-cols-7 relative">
                  {HOURS.map((hour) => (
                    <div key={`line-${hour}`} className="absolute left-0 right-0 border-t border-border/20" style={{ top: (hour - HOUR_START) * HOUR_HEIGHT_PX }} />
                  ))}

                  {days.map((day) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayDispos = dispoByDay.get(dayKey) ?? [];
                    const weekend = isWeekend(day);
                    const today = isToday(day);

                    return (
                      <div
                        key={dayKey}
                        className={cn(
                          "relative border-r border-border/20 last:border-r-0",
                          weekend && "bg-muted/10",
                          today && "bg-primary/[0.03]"
                        )}
                        style={{ height: HOURS.length * HOUR_HEIGHT_PX }}
                      >
                        {dayDispos.map((dispo) => {
                          const startTime = parseTime(dispo.heure_debut);
                          const endTime = parseTime(dispo.heure_fin);
                          const top = (startTime - HOUR_START) * HOUR_HEIGHT_PX;
                          const height = Math.max((endTime - startTime) * HOUR_HEIGHT_PX, 20);
                          const config = DISPO_COLORS[dispo.type] ?? DISPO_COLORS.disponible;
                          const Icon = config.icon;

                          return (
                            <div
                              key={dispo.id}
                              className={cn(
                                "absolute left-0.5 right-0.5 rounded-md border px-1.5 py-1 overflow-hidden group",
                                config.bg, config.border
                              )}
                              style={{ top, height }}
                            >
                              <div className="flex items-center justify-between gap-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                  <Icon className={cn("h-3 w-3 shrink-0", config.text)} />
                                  <span className={cn("text-[10px] font-medium truncate", config.text)}>
                                    {dispo.heure_debut.slice(0, 5)} - {dispo.heure_fin.slice(0, 5)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(dispo)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 hover:bg-red-500/20"
                                >
                                  <Trash2 className="h-3 w-3 text-red-400" />
                                </button>
                              </div>
                              {dispo.note && height > 30 && (
                                <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">{dispo.note}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ajouter une disponibilite</DialogTitle>
            <DialogDescription>Declarez une plage horaire</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dispo-date" className="text-xs">Date</Label>
              <Input id="dispo-date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="dispo-debut" className="text-xs">Debut</Label>
                <Input id="dispo-debut" type="time" value={formDebut} onChange={(e) => setFormDebut(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dispo-fin" className="text-xs">Fin</Label>
                <Input id="dispo-fin" type="time" value={formFin} onChange={(e) => setFormFin(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispo-type" className="text-xs">Type</Label>
              <select
                id="dispo-type"
                value={formType}
                onChange={(e) => setFormType(e.target.value as typeof formType)}
                className="flex h-9 w-full rounded-md border border-border/60 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="disponible">Disponible</option>
                <option value="indisponible">Indisponible</option>
                <option value="sous_reserve">Sous reserve</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dispo-note" className="text-xs">Note (optionnel)</Label>
              <Input id="dispo-note" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Ex: RDV medical..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>Annuler</Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Ajout..." : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
