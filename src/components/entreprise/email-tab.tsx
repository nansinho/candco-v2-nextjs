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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
  getMembreEmails,
  getEntrepriseEmailHistory,
  sendTargetedEmail,
  type MembreEmail,
  type EmailHistoryItem,
} from "@/actions/entreprise-emails";
import { getAgences, type Agence } from "@/actions/entreprise-organisation";

// ─── Constants ───────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: "direction", label: "Direction" },
  { value: "responsable_formation", label: "Resp. formation" },
  { value: "manager", label: "Manager" },
  { value: "employe", label: "Employé" },
] as const;

const ROLE_COLORS: Record<string, string> = {
  direction: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  responsable_formation: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  manager: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  employe: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
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

  // Filters
  const [selectionMode, setSelectionMode] = React.useState<"all" | "filtered">("all");
  const [selectedAgenceIds, setSelectedAgenceIds] = React.useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [includeSiege, setIncludeSiege] = React.useState(true);
  const [showFilters, setShowFilters] = React.useState(false);

  // Compose
  const [showCompose, setShowCompose] = React.useState(false);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [useBcc, setUseBcc] = React.useState(true);
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

  const filteredMembres = React.useMemo(() => {
    if (selectionMode === "all") return membres;

    return membres.filter((m) => {
      // Filter by agence
      if (selectedAgenceIds.length > 0) {
        const hasMatchingAgence = m.agence_ids.some((id) => selectedAgenceIds.includes(id));
        const matchesSiege = includeSiege && m.rattache_siege;
        if (!hasMatchingAgence && !matchesSiege) return false;
      }

      // Filter by role
      if (selectedRoles.length > 0) {
        const hasMatchingRole = m.roles.some((r) => selectedRoles.includes(r));
        if (!hasMatchingRole) return false;
      }

      return true;
    });
  }, [membres, selectionMode, selectedAgenceIds, selectedRoles, includeSiege]);

  const withEmail = filteredMembres.filter((m) => m.email);
  const withoutEmail = filteredMembres.filter((m) => !m.email);
  const uniqueEmails: string[] = Array.from(new Set(withEmail.map((m) => m.email!)));

  // ─── Toggle helpers ──────────────────────────────────

  function toggleAgence(agenceId: string) {
    setSelectedAgenceIds((prev) =>
      prev.includes(agenceId) ? prev.filter((id) => id !== agenceId) : [...prev, agenceId]
    );
  }

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
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
      description: `Envoyer cet email à ${uniqueEmails.length} destinataire${uniqueEmails.length > 1 ? "s" : ""} ?`,
      confirmLabel: "Envoyer",
    });

    if (!ok) return;

    setIsSending(true);

    const result = await sendTargetedEmail({
      entrepriseId,
      subject,
      body,
      recipientEmails: uniqueEmails,
      filterCriteria: {
        mode: selectionMode,
        agenceIds: selectedAgenceIds.length > 0 ? selectedAgenceIds : undefined,
        roles: selectedRoles.length > 0 ? selectedRoles : undefined,
        includesSiege: includeSiege,
      },
      useBcc,
    });

    setIsSending(false);

    if (result.sent > 0) {
      toast({
        title: "Email envoyé",
        description: `${result.sent} email(s) envoyé(s)${result.failed > 0 ? `, ${result.failed} en erreur` : ""}`,
        variant: result.failed > 0 ? "destructive" : "success",
      });
      setShowCompose(false);
      setSubject("");
      setBody("");
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
      {/* ─── Recipient Selection ─────────────────────── */}
      <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-medium">Destinataires</h3>
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
              setShowFilters(false);
            }}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              selectionMode === "all"
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <Users className="mr-1.5 inline h-3 w-3" />
            Tous les membres
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectionMode("filtered");
              setShowFilters(true);
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

        {/* Filters */}
        {selectionMode === "filtered" && showFilters && (
          <div className="space-y-3 rounded-md border border-border/40 bg-muted/30 p-3">
            {/* Agences filter */}
            {agences.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Agences / Sites</Label>
                <div className="flex flex-wrap gap-1.5">
                  {agences.map((agence) => (
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
                      {agence.est_siege && (
                        <Badge className="ml-1 h-4 bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] px-1">
                          Siège
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
                {selectedAgenceIds.length > 0 && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeSiege}
                      onChange={(e) => setIncludeSiege(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border/60 bg-background accent-primary"
                    />
                    Inclure les membres rattachés au siège social
                  </label>
                )}
              </div>
            )}

            {/* Roles filter */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Rôles</Label>
              <div className="flex flex-wrap gap-1.5">
                {ROLE_OPTIONS.map((r) => {
                  const isActive = selectedRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                        isActive
                          ? ROLE_COLORS[r.value] + " border-current"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
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
            {uniqueEmails.length !== withEmail.length && (
              <span className="text-muted-foreground">
                ({withEmail.length - uniqueEmails.length} doublon{withEmail.length - uniqueEmails.length > 1 ? "s" : ""} retiré{withEmail.length - uniqueEmails.length > 1 ? "s" : ""})
              </span>
            )}
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={uniqueEmails.length === 0}
            onClick={() => setShowCompose(true)}
          >
            <Mail className="mr-1.5 h-3 w-3" />
            Composer l'email
          </Button>
        </div>

        {/* Active filters summary */}
        {selectionMode === "filtered" && (selectedAgenceIds.length > 0 || selectedRoles.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
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
            {selectedRoles.map((r) => {
              const role = ROLE_OPTIONS.find((ro) => ro.value === r);
              return role ? (
                <Badge
                  key={r}
                  className={`${ROLE_COLORS[r]} text-[10px] gap-1 pr-1`}
                >
                  {role.label}
                  <button onClick={() => toggleRole(r)} className="ml-0.5 hover:text-foreground">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ) : null;
            })}
            {includeSiege && selectedAgenceIds.length > 0 && (
              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                + Siège social
              </Badge>
            )}
          </div>
        )}

        {/* Recipient preview (collapsible) */}
        {uniqueEmails.length > 0 && (
          <RecipientPreview
            recipients={withEmail}
            uniqueEmails={uniqueEmails}
          />
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

      {/* ─── Compose Dialog ──────────────────────────── */}
      <Dialog open={showCompose} onOpenChange={setShowCompose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Composer un email</DialogTitle>
            <DialogDescription>
              {uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""} sélectionné{uniqueEmails.length > 1 ? "s" : ""}
              {selectionMode === "filtered" && " (filtré)"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* BCC toggle */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={useBcc}
                onChange={(e) => setUseBcc(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border/60 bg-background accent-primary"
              />
              Envoi en CCI (copie cachée) — les destinataires ne verront pas les autres adresses
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
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCompose(false)}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || !subject.trim() || !body.trim() || uniqueEmails.length === 0}
              className="text-xs"
            >
              {isSending ? (
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3 w-3" />
              )}
              Envoyer à {uniqueEmails.length} destinataire{uniqueEmails.length > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}

// ─── Recipient Preview ───────────────────────────────────

function RecipientPreview({
  recipients,
  uniqueEmails,
}: {
  recipients: MembreEmail[];
  uniqueEmails: string[];
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

  const preview = expanded ? displayList : displayList.slice(0, 5);
  const hasMore = displayList.length > 5;

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
        Aperçu des destinataires
      </button>

      {expanded && (
        <div className="rounded-md border border-border/30 bg-muted/20 divide-y divide-border/20 max-h-60 overflow-y-auto">
          {preview.map((r) => (
            <div key={r.email} className="flex items-center justify-between px-3 py-1.5 text-[11px]">
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
                    {ROLE_OPTIONS.find((ro) => ro.value === role)?.label ?? role}
                  </span>
                ))}
                {r.agence_noms.length > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    · {r.agence_noms.join(", ")}
                  </span>
                )}
              </div>
            </div>
          ))}
          {hasMore && !expanded && (
            <div className="px-3 py-1.5 text-center text-[11px] text-muted-foreground">
              + {displayList.length - 5} autres...
            </div>
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

  const metadata = item.metadata as { recipient_count?: number; filter_criteria?: Record<string, unknown> } | null;

  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{item.sujet}</p>
          <p className="text-muted-foreground truncate mt-0.5">
            {item.destinataire_nom ?? item.destinataire_email}
            {metadata?.recipient_count && metadata.recipient_count > 1 && (
              <span className="ml-1">({metadata.recipient_count} destinataires)</span>
            )}
          </p>
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
