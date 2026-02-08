"use client";

import * as React from "react";
import {
  Mail,
  Send,
  Users,
  Filter,
  ChevronDown,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Building,
  Eye,
  X,
  UserMinus,
  EyeOff,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import {
  getMembreEmails,
  getEntrepriseEmailHistory,
  sendTargetedEmail,
  type MembreEmail,
  type EmailHistoryItem,
} from "@/actions/entreprise-emails";
import { getAgences, type Agence } from "@/actions/entreprise-organisation";

// ─── Constants ───────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  direction: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  responsable_formation: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  manager: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  employe: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

const ROLE_LABELS: Record<string, string> = {
  direction: "Direction",
  responsable_formation: "Resp. formation",
  manager: "Manager",
  employe: "Employé",
};

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  envoye: { icon: CheckCircle2, color: "text-green-400", label: "Envoyé" },
  delivre: { icon: CheckCircle2, color: "text-green-400", label: "Délivré" },
  ouvert: { icon: Eye, color: "text-blue-400", label: "Ouvert" },
  erreur: { icon: XCircle, color: "text-red-400", label: "Erreur" },
};

// ─── Main Component ──────────────────────────────────────

export function EmailTab({ entrepriseId }: { entrepriseId: string }) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  // Data
  const [membres, setMembres] = React.useState<MembreEmail[]>([]);
  const [agences, setAgences] = React.useState<Agence[]>([]);
  const [history, setHistory] = React.useState<EmailHistoryItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Mode & Scope
  const [selectionMode, setSelectionMode] = React.useState<"all" | "filtered">("all");
  const [selectedAgenceIds, setSelectedAgenceIds] = React.useState<string[]>([]);
  const [includeSiege, setIncludeSiege] = React.useState(false);

  // Manual exclusions
  const [excludedEmails, setExcludedEmails] = React.useState<Set<string>>(new Set());

  // Compose (inline)
  const [showCompose, setShowCompose] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [useBcc, setUseBcc] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  // History section
  const [showHistory, setShowHistory] = React.useState(true);

  // ─── Load data ───────────────────────────────────────

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    const [membresResult, agencesResult, historyResult] = await Promise.all([
      getMembreEmails(entrepriseId),
      getAgences(entrepriseId),
      getEntrepriseEmailHistory(entrepriseId),
    ]);
    setMembres(membresResult.data);
    setAgences(agencesResult.data ?? []);
    setHistory(historyResult.data);
    setIsLoading(false);
  }, [entrepriseId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Filtered recipients ─────────────────────────────

  const siegeAgence = agences.find((a) => a.est_siege);

  const filteredMembres = React.useMemo(() => {
    if (selectionMode === "all") return membres;

    return membres.filter((m) => {
      // Filter by scope: siège + selected agences
      const matchesSiege = includeSiege && m.rattache_siege;
      const hasMatchingAgence = selectedAgenceIds.length > 0 &&
        m.agence_ids.some((id) => selectedAgenceIds.includes(id));

      // If siège agence is in selectedAgenceIds, also match members rattache_siege
      const siegeSelected = siegeAgence && selectedAgenceIds.includes(siegeAgence.id);
      const matchesSiegeViaAgence = siegeSelected && m.rattache_siege;

      return matchesSiege || hasMatchingAgence || matchesSiegeViaAgence;
    });
  }, [membres, selectionMode, selectedAgenceIds, includeSiege, siegeAgence]);

  const withEmail = filteredMembres.filter((m) => m.email);
  const withoutEmail = filteredMembres.filter((m) => !m.email);

  // Build unique email list, minus exclusions
  const uniqueEmails: string[] = React.useMemo(() => {
    const emails = Array.from(new Set(withEmail.map((m) => m.email!)));
    return emails.filter((e) => !excludedEmails.has(e));
  }, [withEmail, excludedEmails]);

  // Scope is valid when at least one perimetre is selected
  const isScopeValid = selectionMode === "all" || includeSiege || selectedAgenceIds.length > 0;

  // ─── Toggle helpers ──────────────────────────────────

  function toggleAgence(agenceId: string) {
    setSelectedAgenceIds((prev) =>
      prev.includes(agenceId) ? prev.filter((id) => id !== agenceId) : [...prev, agenceId]
    );
    // Reset exclusions when scope changes
    setExcludedEmails(new Set());
  }

  function toggleSiege() {
    setIncludeSiege((prev) => !prev);
    setExcludedEmails(new Set());
  }

  function excludeRecipient(email: string) {
    setExcludedEmails((prev) => new Set([...prev, email]));
  }

  function restoreRecipient(email: string) {
    setExcludedEmails((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  }

  function resetCompose() {
    setShowCompose(false);
    setSubject("");
    setBody("");
    setUseBcc(false);
    setExcludedEmails(new Set());
  }

  // ─── Send email ──────────────────────────────────────

  async function handleSend() {
    if (uniqueEmails.length === 0) {
      toast({ title: "Erreur", description: "Aucun destinataire avec email", variant: "destructive" });
      return;
    }

    if (!subject.trim() || !body.trim()) {
      toast({ title: "Erreur", description: "L'objet et le message sont requis", variant: "destructive" });
      return;
    }

    const ok = await confirm({
      title: "Confirmer l'envoi",
      description: `Envoyer cet email à ${uniqueEmails.length} destinataire${uniqueEmails.length > 1 ? "s" : ""} ?${useBcc ? "\n(Envoi en CCI — les adresses seront masquées)" : ""}`,
      confirmLabel: "Envoyer",
    });

    if (!ok) return;

    setIsSending(true);

    // Build agence names for traceability
    const agenceNoms = selectedAgenceIds
      .map((id) => agences.find((a) => a.id === id)?.nom)
      .filter(Boolean) as string[];

    const result = await sendTargetedEmail({
      entrepriseId,
      subject,
      body,
      recipientEmails: uniqueEmails,
      filterCriteria: {
        mode: selectionMode,
        agenceIds: selectedAgenceIds.length > 0 ? selectedAgenceIds : undefined,
        agenceNoms: agenceNoms.length > 0 ? agenceNoms : undefined,
        includesSiege: includeSiege,
      },
      useBcc,
      excludedEmails: excludedEmails.size > 0 ? Array.from(excludedEmails) : undefined,
    });

    setIsSending(false);

    if (result.sent > 0) {
      toast({
        title: "Email envoyé",
        description: `${result.sent} email(s) envoyé(s)${result.failed > 0 ? `, ${result.failed} en erreur` : ""}`,
        variant: result.failed > 0 ? "destructive" : "success",
      });
      resetCompose();
      // Refresh history
      const historyResult = await getEntrepriseEmailHistory(entrepriseId);
      setHistory(historyResult.data);
    } else {
      toast({
        title: "Erreur d'envoi",
        description: result.error || "L'email n'a pas pu être envoyé",
        variant: "destructive",
      });
    }
  }

  // ─── Insert variable ────────────────────────────────

  function insertVariable(varName: string) {
    setBody((prev) => prev + `{{${varName}}}`);
  }

  // ─── Render ──────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Step 1: Mode Selection ────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Envoyer un email</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{membres.length} membre{membres.length > 1 ? "s" : ""} total</span>
            <span>·</span>
            <span>{membres.filter((m) => m.email).length} avec email</span>
            {membres.filter((m) => !m.email).length > 0 && (
              <>
                <span>·</span>
                <span className="text-amber-400">
                  {membres.filter((m) => !m.email).length} sans email
                </span>
              </>
            )}
          </div>
        </div>

        {/* Mode selection */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionMode("all");
              setExcludedEmails(new Set());
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectionMode === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Users className="mr-1.5 inline h-3 w-3" />
            Envoyer à tous les membres
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode("filtered");
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectionMode === "filtered"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Filter className="mr-1.5 inline h-3 w-3" />
            Envoi ciblé
          </button>
        </div>

        {/* Global mode info */}
        {selectionMode === "all" && (
          <div className="rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <Users className="mr-1.5 inline h-3 w-3 text-primary" />
            Email envoyé à tous les membres de l'entreprise —{" "}
            <span className="font-medium text-foreground">{uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""}</span>
          </div>
        )}

        {/* ─── Step 2: Scope Selection (targeted mode) ── */}
        {selectionMode === "filtered" && (
          <div className="space-y-3 rounded-md border border-border/40 bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <Label className="text-xs font-medium">Périmètre d'envoi</Label>
              <span className="text-[10px] text-muted-foreground">(au moins un obligatoire)</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {/* Siège social checkbox */}
              <button
                type="button"
                onClick={toggleSiege}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  includeSiege
                    ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Building className="h-3 w-3" />
                Siège social
                {includeSiege && <CheckCircle2 className="h-3 w-3" />}
              </button>

              {/* Agences */}
              {agences.filter((a) => !a.est_siege).map((agence) => (
                <button
                  key={agence.id}
                  type="button"
                  onClick={() => toggleAgence(agence.id)}
                  className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    selectedAgenceIds.includes(agence.id)
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Building className="h-3 w-3" />
                  {agence.nom}
                  {selectedAgenceIds.includes(agence.id) && <CheckCircle2 className="h-3 w-3" />}
                </button>
              ))}
            </div>

            {!isScopeValid && (
              <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Sélectionnez au moins le siège ou une agence
              </p>
            )}
          </div>
        )}

        {/* ─── Recipient summary ─────────────────────────── */}
        <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2">
          <div className="flex items-center gap-4 text-xs">
            <span className="font-medium text-foreground">
              {uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""}
            </span>
            {withoutEmail.length > 0 && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertCircle className="h-3 w-3" />
                {withoutEmail.length} exclu{withoutEmail.length > 1 ? "s" : ""} (sans email)
              </span>
            )}
            {excludedEmails.size > 0 && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <UserMinus className="h-3 w-3" />
                {excludedEmails.size} retiré{excludedEmails.size > 1 ? "s" : ""} manuellement
              </span>
            )}
            {(() => {
              const allWithEmail = withEmail.length;
              const unique = uniqueEmails.length + excludedEmails.size;
              const duplicates = allWithEmail - (unique);
              return duplicates > 0 ? (
                <span className="text-muted-foreground">
                  ({duplicates} doublon{duplicates > 1 ? "s" : ""} retiré{duplicates > 1 ? "s" : ""})
                </span>
              ) : null;
            })()}
          </div>
          {!showCompose && (
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={uniqueEmails.length === 0 || !isScopeValid}
              onClick={() => setShowCompose(true)}
            >
              <Mail className="mr-1.5 h-3 w-3" />
              Composer l'email
            </Button>
          )}
        </div>

        {/* Active scope tags */}
        {selectionMode === "filtered" && (includeSiege || selectedAgenceIds.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {includeSiege && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] gap-1 pr-1">
                <Building className="h-2.5 w-2.5" />
                Siège social
                <button onClick={toggleSiege} className="ml-0.5 hover:text-foreground">
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            )}
            {selectedAgenceIds.map((id) => {
              const ag = agences.find((a) => a.id === id);
              return ag ? (
                <Badge
                  key={id}
                  className="bg-primary/10 text-primary border-primary/30 text-[10px] gap-1 pr-1"
                >
                  <Building className="h-2.5 w-2.5" />
                  {ag.nom}
                  <button onClick={() => toggleAgence(id)} className="ml-0.5 hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ) : null;
            })}
          </div>
        )}

        {/* ─── Recipient preview (with manual exclusion) ─ */}
        {uniqueEmails.length > 0 && (
          <RecipientPreview
            recipients={withEmail}
            uniqueEmails={uniqueEmails}
            excludedEmails={excludedEmails}
            onExclude={excludeRecipient}
            onRestore={restoreRecipient}
          />
        )}

        {/* ─── Inline Compose Form ──────────────────────── */}
        {showCompose && (
          <>
            <Separator className="border-border/40" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-primary" />
                  Rédiger l'email
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={resetCompose}
                >
                  <X className="mr-1 h-3 w-3" />
                  Annuler
                </Button>
              </div>

              {/* BCC option */}
              <label className="flex items-center gap-2.5 rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs cursor-pointer hover:border-border/60 transition-colors">
                <input
                  type="checkbox"
                  checked={useBcc}
                  onChange={(e) => setUseBcc(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border/60 bg-background accent-primary"
                />
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Envoyer en CCI{" "}
                  <span className="text-[10px]">(les destinataires ne verront pas les autres adresses)</span>
                </span>
              </label>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs">Objet</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet de l'email..."
                  className="h-9 text-sm"
                />
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Message</Label>
                  {!useBcc && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">Variables :</span>
                      {["prenom", "nom", "nom_complet"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="rounded border border-border/40 bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-border transition-colors"
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Votre message..."
                  rows={10}
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
                />
              </div>

              {/* Send bar */}
              <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  <span>
                    {uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""}
                  </span>
                  {useBcc && (
                    <Badge className="bg-muted text-muted-foreground border-border/60 text-[10px]">
                      CCI
                    </Badge>
                  )}
                  {selectionMode === "all" ? (
                    <Badge className="bg-muted text-muted-foreground border-border/60 text-[10px]">
                      Global
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground border-border/60 text-[10px]">
                      Ciblé
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !subject.trim() || !body.trim() || uniqueEmails.length === 0}
                  className="text-xs"
                  size="sm"
                >
                  {isSending ? (
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1.5 h-3 w-3" />
                  )}
                  Envoyer à {uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ─── Email History ───────────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card">
        <button
          type="button"
          className="flex w-full items-center justify-between p-4"
          onClick={() => setShowHistory(!showHistory)}
        >
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Historique des envois</h3>
            <Badge className="bg-muted text-muted-foreground border-border/60 text-[10px]">
              {history.length}
            </Badge>
          </div>
          {showHistory ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showHistory && (
          <div className="border-t border-border/40">
            {history.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Aucun email envoyé depuis cette entreprise
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {history.map((item) => (
                  <EmailHistoryRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog />
    </div>
  );
}

// ─── Recipient Preview ───────────────────────────────────

function RecipientPreview({
  recipients,
  uniqueEmails,
  excludedEmails,
  onExclude,
  onRestore,
}: {
  recipients: MembreEmail[];
  uniqueEmails: string[];
  excludedEmails: Set<string>;
  onExclude: (email: string) => void;
  onRestore: (email: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);

  // Deduplicate by email for display
  const displayList: MembreEmail[] = [];
  const seen = new Set<string>();
  for (const r of recipients) {
    if (r.email && !seen.has(r.email)) {
      seen.add(r.email);
      displayList.push(r);
    }
  }

  // Also show excluded recipients (so they can be restored)
  const activeList = displayList.filter((r) => !excludedEmails.has(r.email!));
  const excludedList = displayList.filter((r) => excludedEmails.has(r.email!));

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Aperçu des destinataires ({activeList.length})
      </button>

      {expanded && (
        <div className="rounded-md border border-border/30 bg-muted/20 divide-y divide-border/20 max-h-60 overflow-y-auto">
          {activeList.map((r) => (
            <div key={r.email} className="flex items-center justify-between px-3 py-1.5 text-[11px] group">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {r.prenom} {r.nom}
                </span>
                <span className="text-muted-foreground">{maskEmail(r.email!)}</span>
              </div>
              <div className="flex items-center gap-1">
                {r.roles.map((role) => (
                  <span
                    key={role}
                    className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${ROLE_COLORS[role] || "text-muted-foreground bg-muted"}`}
                  >
                    {ROLE_LABELS[role] ?? role}
                  </span>
                ))}
                {r.agence_noms.length > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    · {r.agence_noms.join(", ")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onExclude(r.email!)}
                  className="ml-1 opacity-0 group-hover:opacity-100 rounded p-0.5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Retirer ce destinataire"
                >
                  <UserMinus className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Excluded recipients */}
          {excludedList.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-muted-foreground bg-muted/30 font-medium">
                Retirés manuellement ({excludedList.length})
              </div>
              {excludedList.map((r) => (
                <div key={r.email} className="flex items-center justify-between px-3 py-1.5 text-[11px] opacity-50 group">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground line-through">
                      {r.prenom} {r.nom}
                    </span>
                    <span className="text-muted-foreground line-through">{maskEmail(r.email!)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(r.email!)}
                    className="opacity-0 group-hover:opacity-100 rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 transition-all"
                  >
                    Restaurer
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Email History Row ───────────────────────────────────

function EmailHistoryRow({ item }: { item: EmailHistoryItem }) {
  const config = STATUS_CONFIG[item.statut] ?? {
    icon: Clock,
    color: "text-muted-foreground",
    label: item.statut,
  };
  const StatusIcon = config.icon;

  const date = new Date(item.created_at);
  const formattedDate = date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const metadata = item.metadata as {
    recipient_count?: number;
    type_envoi?: string;
    perimetre?: string | string[];
    bcc?: boolean;
    excluded_count?: number;
    filter_criteria?: Record<string, unknown>;
  } | null;

  const typeEnvoi = metadata?.type_envoi;
  const perimetre = metadata?.perimetre;
  const isBcc = metadata?.bcc;
  const recipientCount = metadata?.recipient_count;

  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{item.sujet}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {recipientCount && (
              <span className="text-muted-foreground">
                {recipientCount} destinataire{recipientCount > 1 ? "s" : ""}
              </span>
            )}
            {typeEnvoi && (
              <Badge className={`text-[9px] px-1 py-0 ${
                typeEnvoi === "global"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                  : "bg-purple-500/10 text-purple-400 border-purple-500/30"
              }`}>
                {typeEnvoi === "global" ? "Global" : "Ciblé"}
              </Badge>
            )}
            {isBcc && (
              <Badge className="text-[9px] px-1 py-0 bg-muted text-muted-foreground border-border/60">
                CCI
              </Badge>
            )}
            {perimetre && (
              <span className="text-[10px] text-muted-foreground">
                {Array.isArray(perimetre) ? perimetre.join(", ") : perimetre}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Badge className={`text-[10px] ${config.color} bg-transparent border-current/30`}>
          {config.label}
        </Badge>
        <span className="text-muted-foreground whitespace-nowrap">
          {formattedDate} · {formattedTime}
        </span>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local}@${domain}`;
  return `${local[0]}${"•".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}
