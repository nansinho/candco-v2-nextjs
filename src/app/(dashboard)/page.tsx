import { Suspense } from "react";
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
  TrendingUp,
  Clock,
  CalendarDays,
  Target,
  Users,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Euro,
  Percent,
  BarChart3,
} from "lucide-react";
import { getOrganisationId } from "@/lib/auth-helpers";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Skeleton components ─────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 rounded bg-muted/40" />
        <div className="h-9 w-9 rounded-lg bg-muted/30" />
      </div>
      <div className="mt-3 h-7 w-16 rounded bg-muted/40" />
      <div className="mt-3 h-3 w-14 rounded bg-muted/20" />
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 animate-pulse">
      <div className="h-4 w-4 rounded bg-muted/30" />
      <div className="space-y-1.5">
        <div className="h-2.5 w-20 rounded bg-muted/30" />
        <div className="h-4 w-12 rounded bg-muted/40" />
      </div>
    </div>
  );
}

function SessionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 animate-pulse"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div className="h-9 w-9 rounded-lg bg-muted/30 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted/30" />
            <div className="h-3.5 w-48 rounded bg-muted/40" />
          </div>
          <div className="h-3 w-16 rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden animate-pulse">
      <div className="flex items-center border-b border-border/40 bg-muted/5 px-4 py-2.5">
        <div className="h-3 w-12 rounded bg-muted/30 mr-6" />
        <div className="h-3 w-24 rounded bg-muted/30 mr-6" />
        <div className="h-3 w-20 rounded bg-muted/30 mr-6" />
        <div className="h-3 w-16 rounded bg-muted/30 flex-1" />
        <div className="h-3 w-20 rounded bg-muted/30" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center border-b border-border/20 px-4 py-3"
          style={{ opacity: 1 - i * 0.12 }}
        >
          <div className="h-3.5 w-16 rounded bg-muted/25 mr-6" />
          <div className="h-3.5 w-32 rounded bg-muted/30 mr-6" />
          <div className="h-3.5 w-20 rounded bg-muted/20 mr-6" />
          <div className="h-3.5 w-24 rounded bg-muted/25 flex-1" />
          <div className="h-5 w-16 rounded-full bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

// ─── Data fetching functions ─────────────────────────────────

async function getStats() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, admin } = result;

  const today = new Date().toISOString().split("T")[0];

  const [
    apprenantsRes,
    entreprisesRes,
    sessionsRes,
    formationsRes,
    facturesRes,
    sessionsEnCoursRes,
    sessionsAVenirRes,
    devisEnAttenteRes,
    formateursRes,
    inscriptionsRes,
  ] = await Promise.all([
    admin.from("apprenants").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("entreprises").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("produits_formation").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("factures").select("total_ttc, statut").eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "en_cours").is("archived_at", null),
    admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).in("statut", ["en_projet", "validee"]).is("archived_at", null).gte("date_debut", today),
    admin.from("devis").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "envoye").is("archived_at", null),
    admin.from("formateurs").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("inscriptions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId),
  ]);

  const factures = facturesRes.data ?? [];
  const facturesTotal = factures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
  const facturesPayees = factures.filter(f => f.statut === "payee").reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
  const facturesEnRetard = factures.filter(f => f.statut === "en_retard").length;

  return {
    apprenants: apprenantsRes.count ?? 0,
    entreprises: entreprisesRes.count ?? 0,
    sessions: sessionsRes.count ?? 0,
    formations: formationsRes.count ?? 0,
    formateurs: formateursRes.count ?? 0,
    inscriptions: inscriptionsRes.count ?? 0,
    facturesTotal,
    facturesPayees,
    facturesEnRetard,
    sessionsEnCours: sessionsEnCoursRes.count ?? 0,
    sessionsAVenir: sessionsAVenirRes.count ?? 0,
    devisEnAttente: devisEnAttenteRes.count ?? 0,
    tauxEncaissement: facturesTotal > 0 ? Math.round((facturesPayees / facturesTotal) * 100) : 0,
  };
}

async function getUpcomingSessions() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { organisationId, admin } = result;
  const today = new Date().toISOString().split("T")[0];

  const { data } = await admin
    .from("sessions")
    .select("id, numero_affichage, nom, statut, date_debut, date_fin")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .gte("date_debut", today)
    .order("date_debut", { ascending: true })
    .limit(6);

  return data ?? [];
}

async function getRecentSessions() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("sessions")
    .select("id, numero_affichage, nom, statut, date_debut, date_fin, updated_at")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(5);

  return data ?? [];
}

async function getRecentDevis() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("devis")
    .select("id, numero_affichage, objet, statut, total_ttc, date_emission, entreprise_id, entreprises(nom)")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  return ((data ?? []) as unknown) as Array<{
    id: string;
    numero_affichage: string | null;
    objet: string | null;
    statut: string;
    total_ttc: number | null;
    date_emission: string;
    entreprise_id: string | null;
    entreprises: { nom: string } | null;
  }>;
}

async function getRecentFactures() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("factures")
    .select("id, numero_affichage, objet, statut, total_ttc, date_emission, entreprise_id, entreprises(nom)")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(5);

  return ((data ?? []) as unknown) as Array<{
    id: string;
    numero_affichage: string | null;
    objet: string | null;
    statut: string;
    total_ttc: number | null;
    date_emission: string;
    entreprise_id: string | null;
    entreprises: { nom: string } | null;
  }>;
}

// ─── Statut helpers ─────────────────────────────────────

const statutSession: Record<string, { label: string; class: string }> = {
  en_creation: { label: "En création", class: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  en_projet: { label: "En projet", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  validee: { label: "Validée", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  en_cours: { label: "En cours", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  a_facturer: { label: "À facturer", class: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  terminee: { label: "Terminée", class: "bg-muted text-muted-foreground border-border" },
  archivee: { label: "Archivée", class: "bg-muted text-muted-foreground border-border" },
};

const statutDevis: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  envoye: { label: "Envoyé", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  signe: { label: "Signé", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  refuse: { label: "Refusé", class: "bg-red-500/10 text-red-400 border-red-500/20" },
  expire: { label: "Expiré", class: "bg-muted text-muted-foreground border-border" },
};

const statutFacture: Record<string, { label: string; class: string }> = {
  brouillon: { label: "Brouillon", class: "bg-gray-500/10 text-gray-400 border-gray-500/20" },
  envoyee: { label: "Envoyée", class: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  payee: { label: "Payée", class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  partiellement_payee: { label: "Partielle", class: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  en_retard: { label: "En retard", class: "bg-red-500/10 text-red-400 border-red-500/20" },
};

// ─── Async Server Components ─────────────────────────────

async function StatsCards() {
  const stats = await getStats();
  if (!stats) return null;

  const cards = [
    { label: "Apprenants", value: stats.apprenants, icon: GraduationCap, href: "/apprenants", color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Entreprises", value: stats.entreprises, icon: Building2, href: "/entreprises", color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Sessions", value: stats.sessions, icon: Calendar, href: "/sessions", color: "text-purple-400", bg: "bg-purple-400/10" },
    { label: "Formations", value: stats.formations, icon: BookOpen, href: "/produits", color: "text-amber-400", bg: "bg-amber-400/10" },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => (
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
  );
}

async function KpiCards() {
  const stats = await getStats();
  if (!stats) return null;

  const kpis = [
    { label: "Sessions en cours", value: String(stats.sessionsEnCours), icon: Clock, color: "text-blue-400" },
    { label: "Sessions à venir", value: String(stats.sessionsAVenir), icon: CalendarDays, color: "text-purple-400" },
    { label: "Devis en attente", value: String(stats.devisEnAttente), icon: Target, color: "text-amber-400" },
    { label: "CA Facturé", value: formatCurrency(stats.facturesTotal), icon: Euro, color: "text-emerald-400" },
    { label: "CA Encaissé", value: formatCurrency(stats.facturesPayees), icon: TrendingUp, color: "text-green-400" },
    { label: "Taux encaissement", value: `${stats.tauxEncaissement}%`, icon: Percent, color: stats.tauxEncaissement >= 80 ? "text-emerald-400" : stats.tauxEncaissement >= 50 ? "text-amber-400" : "text-red-400" },
    { label: "Factures en retard", value: String(stats.facturesEnRetard), icon: AlertTriangle, color: stats.facturesEnRetard > 0 ? "text-red-400" : "text-emerald-400" },
    { label: "Formateurs", value: String(stats.formateurs), icon: UserCheck, color: "text-cyan-400" },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3">
          <kpi.icon className={`h-4 w-4 ${kpi.color} shrink-0`} />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
            <p className="text-sm font-semibold">{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

async function UpcomingSessionsList() {
  const sessions = await getUpcomingSessions();

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border/60 bg-card py-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
          <Calendar className="h-6 w-6 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground/60">Aucune session à venir</p>
        <Link href="/sessions" className="text-xs text-primary hover:underline">
          Créer une session
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const statut = statutSession[session.statut] ?? { label: session.statut, class: "bg-muted text-muted-foreground border-border" };
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
  );
}

async function RecentActivityList() {
  const sessions = await getRecentSessions();
  if (sessions.length === 0) return null;

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const statut = statutSession[session.statut] ?? { label: session.statut, class: "bg-muted text-muted-foreground border-border" };
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
  );
}

async function RecentDevisList() {
  const devis = await getRecentDevis();

  if (devis.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground/50">Aucun devis</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {devis.map((d) => {
        const statut = statutDevis[d.statut] ?? { label: d.statut, class: "bg-muted text-muted-foreground border-border" };
        return (
          <Link
            key={d.id}
            href={`/devis/${d.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground/50">{d.numero_affichage}</span>
                <span className="text-[12px] truncate">{d.objet || (d.entreprises as { nom: string } | null)?.nom || "—"}</span>
              </div>
            </div>
            <span className="text-[12px] font-medium tabular-nums shrink-0">
              {d.total_ttc ? formatCurrency(Number(d.total_ttc)) : "—"}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statut.class} shrink-0`}>
              {statut.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

async function RecentFacturesList() {
  const factures = await getRecentFactures();

  if (factures.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-muted-foreground/50">Aucune facture</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/30">
      {factures.map((f) => {
        const statut = statutFacture[f.statut] ?? { label: f.statut, class: "bg-muted text-muted-foreground border-border" };
        return (
          <Link
            key={f.id}
            href={`/factures/${f.id}`}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground/50">{f.numero_affichage}</span>
                <span className="text-[12px] truncate">{f.objet || (f.entreprises as { nom: string } | null)?.nom || "—"}</span>
              </div>
            </div>
            <span className="text-[12px] font-medium tabular-nums shrink-0">
              {f.total_ttc ? formatCurrency(Number(f.total_ttc)) : "—"}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statut.class} shrink-0`}>
              {statut.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Quick Actions ───────────────────────────────────────

const quickActions = [
  { label: "Nouvel apprenant", href: "/apprenants", icon: GraduationCap },
  { label: "Nouvelle entreprise", href: "/entreprises", icon: Building2 },
  { label: "Nouvelle session", href: "/sessions", icon: Calendar },
  { label: "Nouvelle formation", href: "/produits", icon: BookOpen },
  { label: "Nouveau devis", href: "/devis", icon: FileText },
  { label: "Nouvelle facture", href: "/factures", icon: Receipt },
];

// ─── Page principale ─────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Vue d&apos;ensemble de votre activité
          </p>
        </div>
        <Link
          href="/indicateurs"
          className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <BarChart3 className="h-4 w-4" />
          Indicateurs détaillés
        </Link>
      </div>

      {/* Stats Cards — streamé */}
      <Suspense fallback={
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      }>
        <StatsCards />
      </Suspense>

      {/* KPIs — streamé */}
      <Suspense fallback={
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
      }>
        <KpiCards />
      </Suspense>

      {/* Grid principal : Sessions + Actions rapides */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sessions à venir + Activité récente */}
        <div className="lg:col-span-2 space-y-6">
          {/* Sessions à venir */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-purple-400" />
                Sessions à venir
              </h2>
              <Link href="/sessions" className="text-xs text-primary hover:underline flex items-center gap-1">
                Voir tout <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <Suspense fallback={<SessionListSkeleton count={4} />}>
              <UpcomingSessionsList />
            </Suspense>
          </div>

          {/* Activité récente */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Activité récente
            </h2>
            <Suspense fallback={<SessionListSkeleton count={3} />}>
              <RecentActivityList />
            </Suspense>
          </div>
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

      {/* Devis et Factures récents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Devis récents */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-amber-400" />
              Derniers devis
            </h2>
            <Link href="/devis" className="text-xs text-primary hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
            <Suspense fallback={<TableSkeleton />}>
              <RecentDevisList />
            </Suspense>
          </div>
        </div>

        {/* Factures récentes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="h-4 w-4 text-emerald-400" />
              Dernières factures
            </h2>
            <Link href="/factures" className="text-xs text-primary hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
            <Suspense fallback={<TableSkeleton />}>
              <RecentFacturesList />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
