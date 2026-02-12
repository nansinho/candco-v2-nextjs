"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  FileText,
  Receipt,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Plus,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  type SessionBillingPipeline,
  type CommanditairePipeline,
  getSessionBillingPipeline,
} from "@/actions/billing-pipeline";
import { createDevisFromCommanditaire } from "@/actions/devis";
import { createFactureAcompte, createFactureSolde } from "@/actions/factures";

// ─── Status helpers ─────────────────────────────────────

const CONVENTION_LABELS: Record<string, string> = {
  aucune: "Aucune",
  brouillon: "Brouillon",
  generee: "Generee",
  envoyee: "Envoyee",
  signee: "Signee",
  refusee: "Refusee",
};

const CONVENTION_COLORS: Record<string, string> = {
  aucune: "text-muted-foreground border-border/60",
  brouillon: "text-slate-400 border-slate-500/30",
  generee: "text-blue-400 border-blue-500/30",
  envoyee: "text-amber-400 border-amber-500/30",
  signee: "text-emerald-400 border-emerald-500/30",
  refusee: "text-red-400 border-red-500/30",
};

const SUBROGATION_LABELS: Record<string, string> = {
  direct: "Direct",
  subrogation_partielle: "Subrogation partielle",
  subrogation_totale: "Subrogation totale",
};

function FactureStatusBadge({ statut }: { statut: string }) {
  const colors: Record<string, string> = {
    brouillon: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    envoyee: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    partiellement_payee: "text-amber-400 border-amber-500/30 bg-amber-500/10",
    payee: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    en_retard: "text-red-400 border-red-500/30 bg-red-500/10",
  };
  const labels: Record<string, string> = {
    brouillon: "Brouillon",
    envoyee: "Envoyee",
    partiellement_payee: "Partiel",
    payee: "Payee",
    en_retard: "En retard",
  };
  return (
    <Badge variant="outline" className={`text-[10px] h-5 ${colors[statut] ?? ""}`}>
      {labels[statut] ?? statut}
    </Badge>
  );
}

function DevisStatusBadge({ statut }: { statut: string }) {
  const colors: Record<string, string> = {
    brouillon: "text-slate-400 border-slate-500/30 bg-slate-500/10",
    envoye: "text-blue-400 border-blue-500/30 bg-blue-500/10",
    signe: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
    refuse: "text-red-400 border-red-500/30 bg-red-500/10",
    expire: "text-muted-foreground border-border/60 bg-muted/10",
    transforme: "text-violet-400 border-violet-500/30 bg-violet-500/10",
  };
  const labels: Record<string, string> = {
    brouillon: "Brouillon",
    envoye: "Envoyé",
    signe: "Signé",
    refuse: "Refusé",
    expire: "Expiré",
    transforme: "Transformé",
  };
  return (
    <Badge variant="outline" className={`text-[10px] h-5 ${colors[statut] ?? ""}`}>
      {labels[statut] ?? statut}
    </Badge>
  );
}

function TypeFactureBadge({ type }: { type: string }) {
  if (type === "standard") return null;
  const colors: Record<string, string> = {
    acompte: "text-amber-400 border-amber-500/30",
    solde: "text-blue-400 border-blue-500/30",
  };
  return (
    <Badge variant="outline" className={`text-[10px] h-5 ${colors[type] ?? ""}`}>
      {type === "acompte" ? "Acompte" : "Solde"}
    </Badge>
  );
}

// ─── Commanditaire Pipeline Card ────────────────────────

function CommanditairePipelineCard({
  pipeline,
  sessionId,
  onRefresh,
}: {
  pipeline: CommanditairePipeline;
  sessionId: string;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState(true);
  const [creating, setCreating] = React.useState<string | null>(null);
  const cmd = pipeline.commanditaire;

  const handleCreateDevis = async () => {
    setCreating("devis");
    try {
      const res = await createDevisFromCommanditaire(sessionId, cmd.id);
      if ("error" in res && res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      } else {
        toast({ title: "Devis cree" });
        onRefresh();
      }
    } finally {
      setCreating(null);
    }
  };

  const handleCreateAcompte = async () => {
    setCreating("acompte");
    try {
      const res = await createFactureAcompte(cmd.id, sessionId, 30);
      if ("error" in res && res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      } else {
        toast({ title: "Facture d'acompte creee (30%)" });
        onRefresh();
      }
    } finally {
      setCreating(null);
    }
  };

  const handleCreateSolde = async () => {
    setCreating("solde");
    try {
      const res = await createFactureSolde(cmd.id, sessionId);
      if ("error" in res && res.error) {
        toast({ title: "Erreur", description: String(res.error), variant: "destructive" });
      } else {
        toast({ title: "Facture de solde creee" });
        onRefresh();
      }
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card">
      {/* Header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 border-b border-border/40 hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          <Building2 className="h-4 w-4 text-muted-foreground/50" />
          <span className="text-sm font-medium">{cmd.entreprise_nom ?? "Commanditaire"}</span>
          {cmd.financeur_nom && (
            <Badge variant="outline" className="text-[10px] h-5">{cmd.financeur_nom}</Badge>
          )}
          {cmd.subrogation_mode !== "direct" && (
            <Badge variant="outline" className="text-[10px] h-5 text-primary border-primary/30">
              {SUBROGATION_LABELS[cmd.subrogation_mode]}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={`text-[10px] h-5 ${CONVENTION_COLORS[cmd.convention_statut] ?? ""}`}>
            Conv. {CONVENTION_LABELS[cmd.convention_statut] ?? cmd.convention_statut}
          </Badge>
          <span className="font-mono text-sm font-medium">{formatCurrency(cmd.budget)}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Subrogation details */}
          {cmd.subrogation_mode !== "direct" && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/20 rounded-md px-3 py-2">
              <span>Entreprise : <span className="font-mono font-medium text-foreground">{formatCurrency(cmd.montant_entreprise)}</span></span>
              <span>Financeur : <span className="font-mono font-medium text-foreground">{formatCurrency(cmd.montant_financeur)}</span></span>
            </div>
          )}

          {/* Pipeline items */}
          <div className="space-y-1.5">
            {/* Devis */}
            {pipeline.devis.map((d) => (
              <Link
                key={d.id}
                href={`/devis/${d.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/20 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="text-xs font-mono text-muted-foreground">{d.numero_affichage}</span>
                  <DevisStatusBadge statut={d.statut} />
                  {d.objet && <span className="text-xs text-muted-foreground/60 truncate max-w-[200px]">{d.objet}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium">{formatCurrency(d.total_ttc)}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
                </div>
              </Link>
            ))}

            {/* Convention */}
            {cmd.convention_statut !== "aucune" && (
              <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/10">
                <div className="flex items-center gap-2">
                  {cmd.convention_statut === "signee" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  ) : cmd.convention_statut === "envoyee" ? (
                    <Send className="h-3.5 w-3.5 text-amber-400" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-muted-foreground/40" />
                  )}
                  <span className="text-xs text-muted-foreground">Convention</span>
                  <Badge variant="outline" className={`text-[10px] h-5 ${CONVENTION_COLORS[cmd.convention_statut] ?? ""}`}>
                    {CONVENTION_LABELS[cmd.convention_statut]}
                  </Badge>
                </div>
                {cmd.convention_pdf_url && (
                  <a href={cmd.convention_pdf_url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    PDF
                  </a>
                )}
              </div>
            )}

            {/* Factures */}
            {pipeline.factures.map((f) => (
              <Link
                key={f.id}
                href={`/factures/${f.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/20 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="text-xs font-mono text-muted-foreground">{f.numero_affichage}</span>
                  <TypeFactureBadge type={f.type_facture} />
                  <FactureStatusBadge statut={f.statut} />
                  {f.objet && <span className="text-xs text-muted-foreground/60 truncate max-w-[200px]">{f.objet}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium">{formatCurrency(f.total_ttc)}</span>
                  {f.montant_paye > 0 && f.montant_paye < f.total_ttc && (
                    <span className="text-[10px] text-amber-400">({formatCurrency(f.montant_paye)} paye)</span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100" />
                </div>
              </Link>
            ))}

            {/* Avoirs */}
            {pipeline.avoirs.map((a) => (
              <Link
                key={a.id}
                href={`/avoirs/${a.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/20 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-red-400/40" />
                  <span className="text-xs font-mono text-red-400">{a.numero_affichage}</span>
                  <Badge variant="outline" className="text-[10px] h-5 text-red-400 border-red-500/30">
                    Avoir
                  </Badge>
                </div>
                <span className="text-xs font-mono font-medium text-red-400">-{formatCurrency(a.total_ttc)}</span>
              </Link>
            ))}

            {/* Empty state */}
            {pipeline.devis.length === 0 && pipeline.factures.length === 0 && cmd.convention_statut === "aucune" && (
              <div className="text-center py-4">
                <p className="text-xs text-muted-foreground/40">Aucun document pour ce commanditaire</p>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex items-center justify-between text-xs border-t border-border/40 pt-3">
            <div className="flex items-center gap-4 text-muted-foreground">
              <span>Facture : <span className="font-mono font-medium text-foreground">{formatCurrency(pipeline.totaux.totalFacture)}</span></span>
              <span>Paye : <span className="font-mono font-medium text-emerald-400">{formatCurrency(pipeline.totaux.totalPaye)}</span></span>
              {pipeline.totaux.resteAFacturer > 0 && (
                <span>Reste a facturer : <span className="font-mono font-medium text-amber-400">{formatCurrency(pipeline.totaux.resteAFacturer)}</span></span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
              onClick={handleCreateDevis}
              disabled={creating !== null}
            >
              <FileText className="mr-1 h-3 w-3" />
              {creating === "devis" ? "..." : "+ Devis"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
              onClick={handleCreateAcompte}
              disabled={creating !== null}
            >
              <Banknote className="mr-1 h-3 w-3" />
              {creating === "acompte" ? "..." : "+ Acompte 30%"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs border-border/60"
              onClick={handleCreateSolde}
              disabled={creating !== null}
            >
              <Receipt className="mr-1 h-3 w-3" />
              {creating === "solde" ? "..." : "+ Solde"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

interface SessionFinancierTabProps {
  sessionId: string;
  financials: {
    budget: number;
    cout: number;
    rentabilite: number;
    totalFacture: number;
    totalPaye: number;
  };
  creneauxCount: number;
  commanditairesCount: number;
}

export function SessionFinancierTab({
  sessionId,
  financials,
  creneauxCount,
  commanditairesCount,
}: SessionFinancierTabProps) {
  const router = useRouter();
  const [pipeline, setPipeline] = React.useState<SessionBillingPipeline | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadPipeline = React.useCallback(async () => {
    setLoading(true);
    const res = await getSessionBillingPipeline(sessionId);
    if (res.data) setPipeline(res.data);
    setLoading(false);
  }, [sessionId]);

  React.useEffect(() => {
    loadPipeline();
  }, [loadPipeline]);

  const handleRefresh = () => {
    loadPipeline();
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider">Budget</p>
          <p className="mt-1 text-lg font-mono font-semibold">{formatCurrency(financials.budget)}</p>
          <p className="text-[10px] text-muted-foreground">{commanditairesCount} cmd.</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider">Facture</p>
          <p className="mt-1 text-lg font-mono font-semibold">{formatCurrency(financials.totalFacture)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider">Paye</p>
          <p className="mt-1 text-lg font-mono font-semibold text-emerald-400">{formatCurrency(financials.totalPaye)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider">Cout</p>
          <p className="mt-1 text-lg font-mono font-semibold text-muted-foreground">{formatCurrency(financials.cout)}</p>
          <p className="text-[10px] text-muted-foreground">{creneauxCount} creneaux</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-card p-4 text-center">
          <p className="text-[10px] text-muted-foreground/60 uppercase font-semibold tracking-wider">Marge</p>
          <p className={`mt-1 text-lg font-mono font-semibold ${financials.rentabilite >= 0 ? "text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(financials.rentabilite)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {financials.budget > 0 ? `${Math.round((financials.rentabilite / financials.budget) * 100)}%` : "--"}
          </p>
        </div>
      </div>

      {/* Pipeline per commanditaire */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : pipeline && pipeline.commanditaires.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Pipeline de facturation par commanditaire</h3>
          {pipeline.commanditaires.map((p) => (
            <CommanditairePipelineCard
              key={p.commanditaire.id}
              pipeline={p}
              sessionId={sessionId}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border/60 bg-card py-16">
          <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground/60">Ajoutez des commanditaires pour commencer la facturation</p>
        </div>
      )}
    </div>
  );
}
