import Link from "next/link";
import { GraduationCap, Building2, Calendar, Receipt, Plus, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { label: "Apprenants", value: "0", icon: GraduationCap, href: "/apprenants", color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Entreprises", value: "0", icon: Building2, href: "/entreprises", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Sessions", value: "0", icon: Calendar, href: "/sessions", color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Factures", value: "0 \u20ac", icon: Receipt, href: "/factures", color: "text-primary", bg: "bg-primary/10" },
  ];

  const quickActions = [
    { label: "Ajouter un apprenant", href: "/apprenants", icon: GraduationCap },
    { label: "Ajouter une entreprise", href: "/entreprises", icon: Building2 },
    { label: "Cr\u00e9er une session", href: "/sessions", icon: Calendar },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace C&CO Formation
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-border/80 hover:bg-card/80"
          >
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-[18px] w-[18px] ${stat.color}`} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
            </div>
            <div className="mt-3 flex items-center text-xs text-muted-foreground/60 group-hover:text-primary transition-colors">
              <span>Voir tout</span>
              <ArrowRight className="ml-1 h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Actions rapides</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-[13px] text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5 text-primary" />
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
