import Link from "next/link";
import { ArrowRight, CircleDot, Loader2, Pause, Flame, LifeBuoy } from "lucide-react";

interface TicketStatsData {
  ouverts: number;
  en_cours: number;
  en_attente: number;
  urgents: number;
  recents: {
    id: string;
    numero_affichage: string;
    titre: string;
    auteur_nom: string | null;
    auteur_type: string;
    created_at: string;
    statut: string;
    priorite: string;
  }[];
}

const ticketStatutDot: Record<string, string> = {
  ouvert: "bg-amber-400",
  en_cours: "bg-blue-400",
  en_attente: "bg-yellow-400",
  resolu: "bg-emerald-400",
  ferme: "bg-zinc-400",
};

export function TicketsWidget({ stats }: { stats: TicketStatsData }) {
  const total = stats.ouverts + stats.en_cours + stats.en_attente;

  if (total === 0 && stats.recents.length === 0) {
    return (
      <div className="flex items-center gap-3 py-1">
        <LifeBuoy className="h-4 w-4 text-muted-foreground/20 shrink-0" />
        <p className="text-xs text-muted-foreground/40">
          Aucun ticket ouvert.{" "}
          <Link href="/tickets" className="text-primary hover:underline">
            Voir les tickets
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Counters row */}
      <div className="flex gap-3">
        <Link
          href="/tickets?statut=ouvert"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <CircleDot className="h-3 w-3 text-amber-400" />
          <span className="font-semibold text-foreground">{stats.ouverts}</span>
          <span>ouverts</span>
        </Link>
        <Link
          href="/tickets?statut=en_cours"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Loader2 className="h-3 w-3 text-blue-400" />
          <span className="font-semibold text-foreground">{stats.en_cours}</span>
          <span>en cours</span>
        </Link>
        <Link
          href="/tickets?statut=en_attente"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors"
        >
          <Pause className="h-3 w-3 text-yellow-400" />
          <span className="font-semibold text-foreground">{stats.en_attente}</span>
          <span>attente</span>
        </Link>
      </div>

      {/* Urgent alert */}
      {stats.urgents > 0 && (
        <Link
          href="/tickets?priorite=urgente"
          className="flex items-center gap-2 rounded-lg bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 hover:border-red-500/20 transition-colors"
        >
          <Flame className="h-3 w-3 text-red-400" />
          <span className="text-xs font-medium text-red-400">
            {stats.urgents} ticket{stats.urgents > 1 ? "s" : ""} urgent{stats.urgents > 1 ? "s" : ""}
          </span>
        </Link>
      )}

      {/* Recent tickets list */}
      {stats.recents.length > 0 && (
        <div className="space-y-1">
          {stats.recents.slice(0, 4).map((ticket) => {
            const dot = ticketStatutDot[ticket.statut] ?? "bg-zinc-500";
            return (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20 transition-colors group"
              >
                <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
                <span className="text-sm truncate flex-1 group-hover:text-primary transition-colors">
                  {ticket.titre}
                </span>
                {ticket.priorite === "urgente" && (
                  <span className="text-xs text-red-400 font-medium shrink-0">Urgent</span>
                )}
              </Link>
            );
          })}
          <Link
            href="/tickets"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground/40 hover:text-primary transition-colors pt-1"
          >
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
