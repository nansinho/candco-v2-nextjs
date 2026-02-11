"use client";

import { useState } from "react";
import { FileText, Clock, CheckCircle2, XCircle, PenLine, ExternalLink } from "lucide-react";
import { checkDevisSignatureStatus } from "@/actions/signatures";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DevisItem = Record<string, any>;

interface ClientDevisListProps {
  devis: DevisItem[];
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  envoye: { label: "En attente de signature", icon: Clock, className: "text-blue-400 bg-blue-500/10" },
  signe: { label: "Signé", icon: CheckCircle2, className: "text-emerald-400 bg-emerald-500/10" },
  refuse: { label: "Refusé", icon: XCircle, className: "text-red-400 bg-red-500/10" },
  expire: { label: "Expiré", icon: Clock, className: "text-[#666] bg-[#1a1a1a]" },
};

const SIGNATURE_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Signature en attente", className: "text-amber-400" },
  signed: { label: "Signé électroniquement", className: "text-emerald-400" },
  rejected: { label: "Signature refusée", className: "text-red-400" },
  expired: { label: "Lien expiré", className: "text-[#666]" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatMontant(amount: number | null): string {
  if (amount === null || amount === undefined) return "—";
  return `${Number(amount).toFixed(2)} €`;
}

export function ClientDevisList({ devis }: ClientDevisListProps) {
  const [refreshing, setRefreshing] = useState<string | null>(null);

  if (!devis || devis.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-12 text-center">
        <FileText className="mx-auto h-10 w-10 text-[#333]" />
        <p className="mt-3 text-sm font-medium text-[#666]">Aucun devis disponible</p>
        <p className="mt-1 text-xs text-[#555]">
          Les devis envoyés par votre organisme de formation apparaîtront ici.
        </p>
      </div>
    );
  }

  async function handleRefreshStatus(devisId: string) {
    setRefreshing(devisId);
    try {
      await checkDevisSignatureStatus(devisId);
    } catch {
      // Silently fail - status will be checked next page load
    }
    setRefreshing(null);
  }

  return (
    <div className="space-y-3">
      {devis.map((d) => {
        const statusCfg = STATUS_CONFIG[d.statut] || STATUS_CONFIG.envoye;
        const sigStatus = d.documenso_status ? SIGNATURE_STATUS[d.documenso_status] : null;
        const StatusIcon = statusCfg.icon;

        return (
          <div
            key={d.id}
            className="rounded-lg border border-[#2a2a2a] bg-[#0a0a0a] p-4 transition hover:border-[#333]"
          >
            <div className="flex items-start justify-between gap-4">
              {/* Left side */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="shrink-0 text-[#F97316]" />
                  <span className="text-sm font-semibold text-white">
                    {d.numero_affichage || "Devis"}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.className}`}>
                    <StatusIcon size={10} />
                    {statusCfg.label}
                  </span>
                </div>
                {d.objet && (
                  <p className="mt-1 truncate text-xs text-[#a0a0a0]">{d.objet}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#666]">
                  <span>Émis le {formatDate(d.date_emission)}</span>
                  {d.date_echeance && <span>Échéance : {formatDate(d.date_echeance)}</span>}
                  {d.entreprises?.nom && <span>{d.entreprises.nom}</span>}
                </div>
                {/* Signature status */}
                {sigStatus && (
                  <div className="mt-2 flex items-center gap-2">
                    <PenLine size={12} className={sigStatus.className} />
                    <span className={`text-[11px] font-medium ${sigStatus.className}`}>
                      {sigStatus.label}
                    </span>
                    {d.signe_le && (
                      <span className="text-[10px] text-[#666]">
                        — {formatDate(d.signe_le)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right side — montant + actions */}
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="text-sm font-bold text-white">
                  {formatMontant(d.total_ttc)}
                </span>
                <span className="text-[10px] text-[#666]">TTC</span>

                {/* Refresh status if pending */}
                {d.documenso_status === "pending" && (
                  <button
                    onClick={() => handleRefreshStatus(d.id)}
                    disabled={refreshing === d.id}
                    className="flex items-center gap-1 rounded-md border border-[#2a2a2a] px-2 py-1 text-[10px] text-[#a0a0a0] transition hover:border-[#F97316] hover:text-[#F97316] disabled:opacity-50"
                  >
                    {refreshing === d.id ? (
                      <div className="h-3 w-3 animate-spin rounded-full border border-[#F97316] border-t-transparent" />
                    ) : (
                      <ExternalLink size={10} />
                    )}
                    Vérifier le statut
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
