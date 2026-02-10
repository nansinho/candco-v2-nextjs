"use client";

import { WidgetGrid, type WidgetConfig } from "@/components/dashboard/widget-grid";
import {
  AdminStatsWidget,
  AdminTicketsWidget,
  AdminActivityWidget,
  AdminOrgsRecentesWidget,
  AdminOrgsUsageWidget,
} from "@/components/admin/admin-widgets";
import type { AdminDashboardStats, AdminActivityRow } from "@/actions/admin";

const DEFAULT_ADMIN_WIDGETS: WidgetConfig[] = [
  { id: "stats", title: "Statistiques globales", size: "large", visible: true },
  { id: "tickets", title: "Tickets support", size: "small", visible: true },
  { id: "orgs-recentes", title: "Organisations récentes", size: "small", visible: true },
  { id: "activite", title: "Activité récente", size: "medium", visible: true },
  { id: "orgs-usage", title: "Top organisations", size: "small", visible: true },
];

interface Props {
  stats: AdminDashboardStats;
  activity: AdminActivityRow[];
  recentOrgs: { id: string; nom: string; created_at: string; users_count: number }[];
  topOrgs: { id: string; nom: string; sessions_count: number; apprenants_count: number }[];
  recentTickets: {
    id: string;
    numero_affichage: string | null;
    titre: string;
    statut: string;
    priorite: string;
    auteur_nom: string | null;
    organisation_id: string;
    organisation_nom: string;
    created_at: string;
  }[];
}

export function AdminDashboardContent({ stats, activity, recentOrgs, topOrgs, recentTickets }: Props) {
  const widgetContent: Record<string, React.ReactNode> = {
    stats: <AdminStatsWidget stats={stats} />,
    tickets: (
      <AdminTicketsWidget
        ticketsOuverts={stats.ticketsOuverts}
        ticketsUrgents={stats.ticketsUrgents}
        recentTickets={recentTickets}
      />
    ),
    "orgs-recentes": <AdminOrgsRecentesWidget orgs={recentOrgs} />,
    activite: <AdminActivityWidget activity={activity} />,
    "orgs-usage": <AdminOrgsUsageWidget orgs={topOrgs} />,
  };

  return (
    <WidgetGrid
      widgets={DEFAULT_ADMIN_WIDGETS}
      storageKey="admin-widgets-layout"
    >
      {widgetContent}
    </WidgetGrid>
  );
}
