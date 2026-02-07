import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Calendar, LifeBuoy } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = createAdminClient();

  // Get global stats
  const [orgsResult, usersResult, sessionsResult, ticketsResult] =
    await Promise.all([
      admin.from("organisations").select("id", { count: "exact", head: true }),
      admin.from("utilisateurs").select("id", { count: "exact", head: true }),
      admin.from("sessions").select("id", { count: "exact", head: true }),
      admin
        .from("tickets")
        .select("id", { count: "exact", head: true })
        .in("statut", ["ouvert", "en_cours"]),
    ]);

  const stats = [
    {
      label: "Organisations",
      value: orgsResult.count || 0,
      icon: Building2,
      href: "/admin/organisations",
    },
    {
      label: "Utilisateurs",
      value: usersResult.count || 0,
      icon: Users,
    },
    {
      label: "Sessions",
      value: sessionsResult.count || 0,
      icon: Calendar,
    },
    {
      label: "Tickets ouverts",
      value: ticketsResult.count || 0,
      icon: LifeBuoy,
      href: "/admin/tickets",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Plateforme</h2>
        <p className="text-muted-foreground">
          Vue globale de tous les organismes de formation
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
