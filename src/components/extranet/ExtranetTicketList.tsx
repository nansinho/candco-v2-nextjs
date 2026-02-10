"use client";

import * as React from "react";
import Link from "next/link";
import {
  LifeBuoy,
  Plus,
  Circle,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getExtranetTickets, type TicketRow } from "@/actions/tickets";
import { formatDate } from "@/lib/utils";

const STATUT_CONFIG: Record<string, { label: string; variant: string; icon: React.ElementType }> = {
  ouvert: { label: "Ouvert", variant: "warning", icon: Circle },
  en_cours: { label: "En cours", variant: "info", icon: Clock },
  en_attente: { label: "En attente", variant: "outline", icon: AlertTriangle },
  resolu: { label: "Résolu", variant: "success", icon: CheckCircle2 },
  ferme: { label: "Fermé", variant: "secondary", icon: XCircle },
};

const PRIORITE_CONFIG: Record<string, { label: string; variant: string }> = {
  urgente: { label: "Urgente", variant: "destructive" },
  haute: { label: "Haute", variant: "warning" },
  normale: { label: "Normale", variant: "info" },
  basse: { label: "Basse", variant: "secondary" },
};

interface ExtranetTicketListProps {
  basePath: string; // e.g., "/extranet/formateur/tickets"
}

export function ExtranetTicketList({ basePath }: ExtranetTicketListProps) {
  const [tickets, setTickets] = React.useState<TicketRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const result = await getExtranetTickets(page);
        setTickets(result.data);
        setTotalCount(result.count);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vos demandes de support et leur suivi
          </p>
        </div>
        <Link href={`${basePath}/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nouveau ticket
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <LifeBuoy className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-4 text-sm font-medium">Aucun ticket</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Vous n&apos;avez pas encore créé de demande de support
          </p>
          <Link href={`${basePath}/new`} className="mt-4">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Créer un ticket
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map((ticket) => {
            const statusConfig = STATUT_CONFIG[ticket.statut];
            const prioriteConfig = PRIORITE_CONFIG[ticket.priorite];
            const StatusIcon = statusConfig?.icon || Circle;

            return (
              <Link
                key={ticket.id}
                href={`${basePath}/${ticket.id}`}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-card p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <LifeBuoy className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{ticket.numero_affichage}</span>
                      <span className="font-medium text-sm truncate">{ticket.titre}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={statusConfig?.variant as "default" || "default"} className="gap-1 text-xs">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig?.label || ticket.statut}
                      </Badge>
                      {prioriteConfig && (
                        <Badge variant={prioriteConfig.variant as "default"} className="text-xs">
                          {prioriteConfig.label}
                        </Badge>
                      )}
                      {ticket.message_count > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />
                          {ticket.message_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">
                  {formatDate(ticket.created_at)}
                </span>
              </Link>
            );
          })}

          {/* Pagination */}
          {totalCount > 25 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} / {Math.ceil(totalCount / 25)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= Math.ceil(totalCount / 25)}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
