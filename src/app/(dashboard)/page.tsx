import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Building2, Calendar, Receipt } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { label: "Apprenants", value: "0", icon: GraduationCap, href: "/apprenants" },
    { label: "Entreprises", value: "0", icon: Building2, href: "/entreprises" },
    { label: "Sessions", value: "0", icon: Calendar, href: "/sessions" },
    { label: "Factures", value: "0 €", icon: Receipt, href: "/factures" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">
          Bienvenue sur C&CO Formation
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
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
