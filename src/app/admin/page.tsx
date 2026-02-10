import { Suspense } from "react";
import {
  getAdminDashboardStats,
  getAdminRecentActivity,
  getAdminRecentOrgs,
  getAdminTopOrgs,
  getAdminRecentTickets,
} from "@/actions/admin";
import { AdminDashboardContent } from "./dashboard-content";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [stats, activity, recentOrgs, topOrgs, recentTickets] = await Promise.all([
    getAdminDashboardStats(),
    getAdminRecentActivity(15),
    getAdminRecentOrgs(5),
    getAdminTopOrgs(5),
    getAdminRecentTickets(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Admin Plateforme</h2>
        <p className="text-sm text-muted-foreground">
          Vue globale de tous les organismes de formation
        </p>
      </div>

      <Suspense fallback={<div className="text-muted-foreground/40 text-sm">Chargement...</div>}>
        <AdminDashboardContent
          stats={stats}
          activity={activity}
          recentOrgs={recentOrgs}
          topOrgs={topOrgs}
          recentTickets={recentTickets}
        />
      </Suspense>
    </div>
  );
}
