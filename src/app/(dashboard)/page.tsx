import Link from "next/link";
import {
  GraduationCap,
  Building2,
  Calendar,
  Receipt,
  Plus,
  ArrowRight,
  BookOpen,
  FileText,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  CalendarDays,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { formatDate, formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  // Fetch real data from the database
  let stats = {
    apprenants: 0,
    entreprises: 0,
    sessions: 0,
    formations: 0,
    facturesTotal: 0,
    sessionsEnCours: 0,
    sessionsAVenir: 0,
    devisEnAttente: 0,
  };

  let recentSessions: {
    id: string;
    numero_affichage: string;
    nom: string;
    statut: string;
    date_debut: string | null;
    date_fin: string | null;
  }[] = [];

  let upcomingSessions: typeof recentSessions = [];

  try {
    const result = await getOrganisationId();
    if (!("error" in result)) {
      const { organisationId, admin } = result;

      const [
        apprenantsRes,
        entreprisesRes,
        sessionsRes,
        formationsRes,
        facturesRes,
        sessionsEnCoursRes,
        sessionsAVenirRes,
        devisRes,
        recentSessionsRes,
        upcomingSessionsRes,
      ] = await Promise.all([
        admin.from("apprenants").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
        admin.from("entreprises").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
        admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
        admin.from("produits_formation").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
        admin.from("factures").select("total_ttc").eq("organisation_id", organisationId).is("archived_at", null),
        admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "en_cours").is("archived_at", null),
        admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).in("statut", ["en_projet", "validee"]).is("archived_at", null).gte("date_debut", new Date().toISOString().split("T")[0]),
        admin.from("devis").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "envoye").is("archived_at", null),
        admin.from("sessions").select("id, numero_affichage, nom, statut, date_debut, date_fin").eq("organisation_id", organisationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(5),
        admin.from("sessions").select("id, numero_affichage, nom, statut, date_debut, date_fin").eq("organisation_id", organisationId).is("archived_at", null).gte("date_debut", new Date().toISOString().split("T")[0]).order("date_debut", { ascending: true }).limit(5),
      ]);

      const facturesTotal = (facturesRes.data ?? []).reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);

      stats = {
        apprenants: apprenantsRes.count ?? 0,
        entreprises: entreprisesRes.count ?? 0,
        sessions: sessionsRes.count ?? 0,
        formations: formationsRes.count ?? 0,
        facturesTotal,
        sessionsEnCours: sessionsEnCoursRes.count ?? 0,
        sessionsAVenir: sessionsAVenirRes.count ?? 0,
        devisEnAttente: devisRes.count ?? 0,
      };

      recentSessions = (recentSessionsRes.data ?? []) as typeof recentSessions;
      upcomingSessions = (upcomingSessionsRes.data ?? []) as typeof upcomingSessions;
    }
  } catch {
    // Silently fail — dashboard will show zeros
  }

  const statCards = [
    { label: "Apprenants", value: String(stats.apprenants), icon: GraduationCap, href: "/apprenants", color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Entreprises", value: String(stats.entreprises), icon: Building2, href: "/entreprises", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Sessions", value: String(stats.sessions), icon: Calendar, href: "/sessions", color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Formations", value: String(stats.formations), icon: BookOpen, href: "/produits", color: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  const kpiCards = [
    { label: "Sessions en cours", value: String(stats.sessionsEnCours), icon: Clock, color: "text-blue-400" },
    { label: "Sessions à venir", value: String(stats.sessionsAVenir), icon: CalendarDays, color: "text-purple-400" },
    { label: "Devis en attente", value: String(stats.devisEnAttente), icon: Target, color: "text-amber-400" },
    { label: "CA Factures", value: formatCurrency(stats.facturesTotal), icon: TrendingUp, color: "text-emerald-400" },
  ];

  const quickActions = [
    { label: "Ajouter un apprenant", href: "/apprenants", icon: GraduationCap },
    { label: "Ajouter une entreprise", href: "/entreprises", icon: Building2 },
    { label: "Créer une session", href: "/sessions", icon: Calendar },
    { label: "Ajouter une formation", href: "/produits", icon: BookOpen },
    { label: "Créer un devis", href: "/devis", icon: FileText },
    { label: "Créer une facture", href: "/factures", icon: Receipt },
  ];

  const statutLabels: Record<string, { label: string; class: string }> = {
    en_projet: { label: "En projet", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    validee: { label: "Validée", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    en_cours: { label: "En cours", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    terminee: { label: "Terminée", class: "bg-muted text-muted-foreground border-border" },
    archivee: { label: "Archivée", class: "bg-muted text-muted-foreground border-border" },
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="mt-1.5 text-muted-foreground">
          Bienvenue sur votre espace C&CO Formation
        </p>
      </div>

      {/* Stats principales */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-xl border border-border bg-card p-4 sm:p-5 transition-all duration-200 hover:border-border/80 hover:bg-card/80"
          >
            <div className="flex items-center justify-between">
              <p className="text-[12px] sm:text-[13px] font-medium text-muted-foreground">{stat.label}</p>
              <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${stat.color}`} />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <span className="text-xl sm:text-2xl font-bold tracking-tight">{stat.value}</span>
            </div>
            <div className="mt-2 sm:mt-3 flex items-center text-xs text-muted-foreground/60 group-hover:text-primary transition-colors">
              <span>Voir tout</span>
              <ArrowRight className="ml-1 h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>

      {/* KPIs en ligne */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
            <kpi.icon className={`h-4 w-4 ${kpi.color} shrink-0`} />
            <div className="min-w-0">
              <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              <p className="text-sm font-semibold">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Sessions + Actions rapides */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sessions à venir */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Sessions à venir</h2>
            <Link href="/sessions" className="text-xs text-primary hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {upcomingSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card py-12">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                <Calendar className="h-6 w-6 text-muted-foreground/30" />
              </div>
              <p className="text-sm text-muted-foreground/60">Aucune session à venir</p>
              <Link href="/sessions" className="text-xs text-primary hover:underline">
                Créer une session
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingSessions.map((session) => {
                const statut = statutLabels[session.statut] ?? { label: session.statut, class: "bg-muted text-muted-foreground border-border" };
                return (
                  <Link
                    key={session.id}
                    href={`/sessions/${session.id}`}
                    className="flex items-center gap-3 sm:gap-4 rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-400/10 shrink-0">
                      <Calendar className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-muted-foreground/60">{session.numero_affichage}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statut.class}`}>
                          {statut.label}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium truncate mt-0.5">{session.nom}</p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      {session.date_debut && (
                        <p className="text-[12px] text-muted-foreground">{formatDate(session.date_debut)}</p>
                      )}
                      {session.date_fin && session.date_fin !== session.date_debut && (
                        <p className="text-[11px] text-muted-foreground/60">→ {formatDate(session.date_fin)}</p>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}

          {/* Activité récente */}
          {recentSessions.length > 0 && (
            <div className="space-y-3 mt-6">
              <h2 className="text-sm font-semibold">Activité récente</h2>
              <div className="space-y-2">
                {recentSessions.map((session) => {
                  const statut = statutLabels[session.statut] ?? { label: session.statut, class: "bg-muted text-muted-foreground border-border" };
                  return (
                    <Link
                      key={session.id}
                      href={`/sessions/${session.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/50 px-4 py-2.5 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground/50">{session.numero_affichage}</span>
                          <span className="text-[13px] truncate">{session.nom}</span>
                        </div>
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statut.class} shrink-0`}>
                        {statut.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions rapides */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold">Actions rapides</h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 text-[13px] text-muted-foreground transition-all hover:border-primary/30 hover:text-foreground group"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <Plus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="flex-1">{action.label}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
