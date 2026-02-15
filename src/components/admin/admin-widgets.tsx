import Link from "next/link";
import {
  Building2,
  Users,
  Calendar,
  GraduationCap,
  UserCheck,
  LifeBuoy,
  Flame,
  ArrowRight,
  Activity,
} from "lucide-react";
import type {
  AdminDashboardStats,
  AdminActivityRow,
} from "@/actions/admin";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Stats Widget ─────────────────────────────────────────

export function AdminStatsWidget({ stats }: { stats: AdminDashboardStats }) {
  const items = [
    { label: "Organisations", value: stats.orgsCount, icon: Building2, href: "/admin/organisations", color: "text-blue-400" },
    { label: "Utilisateurs", value: stats.usersCount, icon: Users, href: "/admin/utilisateurs", color: "text-violet-400" },
    { label: "Sessions", value: stats.sessionsCount, icon: Calendar, color: "text-emerald-400" },
    { label: "Apprenants", value: stats.apprenantsCount, icon: GraduationCap, color: "text-amber-400" },
    { label: "Formateurs", value: stats.formateursCount, icon: UserCheck, color: "text-cyan-400" },
    { label: "Tickets ouverts", value: stats.ticketsOuverts, icon: LifeBuoy, href: "/admin/tickets", color: "text-orange-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {items.map((item) => {
        const content = (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg border border-border/30 px-3 py-2.5 hover:border-border/60 transition-colors"
          >
            <item.icon className={`h-4 w-4 ${item.color} shrink-0`} />
            <div className="min-w-0">
              <p className="text-lg font-bold leading-none">{item.value}</p>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{item.label}</p>
            </div>
          </div>
        );
        return item.href ? (
          <Link key={item.label} href={item.href}>{content}</Link>
        ) : (
          <div key={item.label}>{content}</div>
        );
      })}
    </div>
  );
}

// ─── Tickets Alert Widget ─────────────────────────────────

interface AdminTicket {
  id: string;
  numero_affichage: string | null;
  titre: string;
  statut: string;
  priorite: string;
  auteur_nom: string | null;
  organisation_id: string;
  organisation_nom: string;
  created_at: string;
}

const ticketStatutDot: Record<string, string> = {
  ouvert: "bg-amber-400",
  en_cours: "bg-blue-400",
  en_attente: "bg-yellow-400",
  resolu: "bg-emerald-400",
  ferme: "bg-zinc-400",
};

export function AdminTicketsWidget({
  ticketsOuverts,
  ticketsUrgents,
  recentTickets,
}: {
  ticketsOuverts: number;
  ticketsUrgents: number;
  recentTickets: AdminTicket[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <LifeBuoy className="h-3 w-3 text-orange-400" />
          <span className="font-semibold text-foreground">{ticketsOuverts}</span>
          <span>ouverts</span>
        </div>
        {ticketsUrgents > 0 && (
          <div className="flex items-center gap-1.5 text-xs">
            <Flame className="h-3 w-3 text-red-400" />
            <span className="font-medium text-red-400">
              {ticketsUrgents} urgent{ticketsUrgents > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {recentTickets.length > 0 && (
        <div className="space-y-1">
          {recentTickets.map((ticket) => {
            const dot = ticketStatutDot[ticket.statut] ?? "bg-zinc-500";
            return (
              <div
                key={ticket.id}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/20 transition-colors"
              >
                <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
                <span className="text-sm truncate flex-1">{ticket.titre}</span>
                <span className="text-xs text-muted-foreground/40 shrink-0">
                  {ticket.organisation_nom}
                </span>
              </div>
            );
          })}
          <Link
            href="/admin/tickets"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground/40 hover:text-primary transition-colors pt-1"
          >
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {recentTickets.length === 0 && ticketsOuverts === 0 && (
        <p className="text-xs text-muted-foreground/40">Aucun ticket ouvert</p>
      )}
    </div>
  );
}

// ─── Activity Widget ──────────────────────────────────────

const moduleIcons: Record<string, React.ElementType> = {
  entreprise: Building2,
  apprenant: GraduationCap,
  formateur: UserCheck,
  session: Calendar,
  ticket: LifeBuoy,
};

const actionColors: Record<string, string> = {
  created: "text-emerald-400",
  updated: "text-blue-400",
  archived: "text-zinc-400",
  deleted: "text-red-400",
  status_changed: "text-amber-400",
  sent: "text-violet-400",
};

export function AdminActivityWidget({ activity }: { activity: AdminActivityRow[] }) {
  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground/40">Aucune activité récente</p>;
  }

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {activity.map((event) => {
        const Icon = moduleIcons[event.module] ?? Activity;
        const actionColor = actionColors[event.action] ?? "text-muted-foreground/60";
        return (
          <div
            key={event.id}
            className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-muted/10 transition-colors"
          >
            <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${actionColor}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs leading-tight">
                <span className="text-muted-foreground/80">{event.description || `${event.action} ${event.module}`}</span>
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground/40">{event.user_nom || "Système"}</span>
                {event.agence_nom && (
                  <span className="text-xs text-muted-foreground/40">{event.agence_nom}</span>
                )}
                <span className="text-xs text-muted-foreground/40">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      <Link
        href="/admin/activite"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground/40 hover:text-primary transition-colors pt-1"
      >
        Voir tout <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Recent Orgs Widget ───────────────────────────────────

interface RecentOrg {
  id: string;
  nom: string;
  created_at: string;
  users_count: number;
}

export function AdminOrgsRecentesWidget({ orgs }: { orgs: RecentOrg[] }) {
  if (orgs.length === 0) {
    return <p className="text-xs text-muted-foreground/40">Aucune organisation</p>;
  }

  return (
    <div className="space-y-1">
      {orgs.map((org) => (
        <Link
          key={org.id}
          href={`/admin/organisations/${org.id}`}
          className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20 transition-colors group"
        >
          <Building2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm truncate group-hover:text-primary transition-colors">
              {org.nom}
            </p>
            <p className="text-xs text-muted-foreground/40">
              {org.users_count} utilisateur{org.users_count > 1 ? "s" : ""} &middot;{" "}
              {formatDistanceToNow(new Date(org.created_at), { addSuffix: true, locale: fr })}
            </p>
          </div>
        </Link>
      ))}
      <Link
        href="/admin/organisations"
        className="flex items-center justify-center gap-1 text-xs text-muted-foreground/40 hover:text-primary transition-colors pt-1"
      >
        Tout voir <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Top Orgs Usage Widget ────────────────────────────────

interface OrgUsage {
  id: string;
  nom: string;
  sessions_count: number;
  apprenants_count: number;
}

export function AdminOrgsUsageWidget({ orgs }: { orgs: OrgUsage[] }) {
  if (orgs.length === 0) {
    return <p className="text-xs text-muted-foreground/40">Aucune donnée</p>;
  }

  const maxTotal = Math.max(...orgs.map((o) => o.sessions_count + o.apprenants_count), 1);

  return (
    <div className="space-y-2.5">
      {orgs.map((org) => {
        const total = org.sessions_count + org.apprenants_count;
        const pct = Math.round((total / maxTotal) * 100);
        return (
          <Link
            key={org.id}
            href={`/admin/organisations/${org.id}`}
            className="block group"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs truncate group-hover:text-primary transition-colors">
                {org.nom}
              </span>
              <span className="text-xs text-muted-foreground/40 shrink-0 ml-2">
                {org.sessions_count} ses. &middot; {org.apprenants_count} app.
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/30">
              <div
                className="h-1.5 rounded-full bg-primary/60 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
