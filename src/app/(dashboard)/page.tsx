import { Suspense } from "react";
import Link from "next/link";
import {
  Calendar,
  ArrowRight,
  FileText,
  Receipt,
  AlertTriangle,
  Euro,
  Users,
  TrendingUp,
  Clock,
  CalendarDays,
  ArrowUpRight,
  CircleDot,
} from "lucide-react";
import { getOrganisationId, getCurrentUser } from "@/lib/auth-helpers";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Skeleton components ─────────────────────────────────

function HeroMetricSkeleton() {
  return (
    <div className="flex-1 min-w-0 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted/30 mb-3" />
      <div className="h-8 w-20 rounded bg-muted/40 mb-2" />
      <div className="h-3 w-16 rounded bg-muted/20" />
    </div>
  );
}


function SessionTimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div className="h-2 w-2 rounded-full bg-muted/30 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-48 rounded bg-muted/30" />
            <div className="h-2.5 w-24 rounded bg-muted/20" />
          </div>
          <div className="h-3 w-16 rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

function ActivityFeedSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 animate-pulse"
          style={{ opacity: 1 - i * 0.15 }}
        >
          <div className="h-7 w-7 rounded bg-muted/30 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-40 rounded bg-muted/30" />
            <div className="h-2.5 w-20 rounded bg-muted/20" />
          </div>
          <div className="h-5 w-14 rounded-full bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

// ─── Data fetching functions ─────────────────────────────────

async function getDashboardData() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, admin } = result;

  const today = new Date().toISOString().split("T")[0];

  const [
    apprenantsRes,
    sessionsActiveRes,
    facturesRes,
    devisEnAttenteRes,
    facturesEnRetardRes,
  ] = await Promise.all([
    admin
      .from("apprenants")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
    admin
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .in("statut", ["en_cours", "validee"])
      .is("archived_at", null),
    admin
      .from("factures")
      .select("total_ttc, statut")
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
    admin
      .from("devis")
      .select("id, numero_affichage, objet, total_ttc, date_emission, entreprises(nom)")
      .eq("organisation_id", organisationId)
      .eq("statut", "envoye")
      .is("archived_at", null)
      .order("date_emission", { ascending: false })
      .limit(5),
    admin
      .from("factures")
      .select("id, numero_affichage, objet, total_ttc, date_echeance, entreprises(nom)")
      .eq("organisation_id", organisationId)
      .eq("statut", "en_retard")
      .is("archived_at", null)
      .order("date_echeance", { ascending: true })
      .limit(5),
  ]);

  const factures = facturesRes.data ?? [];
  const caFacture = factures.reduce(
    (sum, f) => sum + (Number(f.total_ttc) || 0),
    0
  );
  const caEncaisse = factures
    .filter((f) => f.statut === "payee")
    .reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);

  return {
    apprenants: apprenantsRes.count ?? 0,
    sessionsActives: sessionsActiveRes.count ?? 0,
    caFacture,
    caEncaisse,
    devisEnAttente: ((devisEnAttenteRes.data ?? []) as unknown) as Array<{
      id: string;
      numero_affichage: string | null;
      objet: string | null;
      total_ttc: number | null;
      date_emission: string;
      entreprises: { nom: string } | null;
    }>,
    facturesEnRetard: ((facturesEnRetardRes.data ?? []) as unknown) as Array<{
      id: string;
      numero_affichage: string | null;
      objet: string | null;
      total_ttc: number | null;
      date_echeance: string | null;
      entreprises: { nom: string } | null;
    }>,
  };
}

async function getUpcomingSessions() {
  const result = await getOrganisationId();
  if ("error" in result) return [];
  const { organisationId, admin } = result;
  const today = new Date().toISOString().split("T")[0];

  const { data } = await admin
    .from("sessions")
    .select(
      "id, numero_affichage, nom, statut, date_debut, date_fin"
    )
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .gte("date_debut", today)
    .order("date_debut", { ascending: true })
    .limit(7);

  return data ?? [];
}

async function getRecentActivity() {
  const result = await getOrganisationId();
  if ("error" in result) return { devis: [], factures: [] };
  const { organisationId, admin } = result;

  const [devisRes, facturesRes] = await Promise.all([
    admin
      .from("devis")
      .select(
        "id, numero_affichage, objet, statut, total_ttc, created_at, entreprises(nom)"
      )
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
    admin
      .from("factures")
      .select(
        "id, numero_affichage, objet, statut, total_ttc, created_at, entreprises(nom)"
      )
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return {
    devis: ((devisRes.data ?? []) as unknown) as Array<{
      id: string;
      numero_affichage: string | null;
      objet: string | null;
      statut: string;
      total_ttc: number | null;
      created_at: string;
      entreprises: { nom: string } | null;
    }>,
    factures: ((facturesRes.data ?? []) as unknown) as Array<{
      id: string;
      numero_affichage: string | null;
      objet: string | null;
      statut: string;
      total_ttc: number | null;
      created_at: string;
      entreprises: { nom: string } | null;
    }>,
  };
}

// ─── Status helpers ─────────────────────────────────────

const statutColors: Record<string, string> = {
  // Sessions
  en_projet: "bg-amber-500",
  validee: "bg-blue-500",
  en_cours: "bg-emerald-500",
  terminee: "bg-zinc-500",
  // Devis
  brouillon: "bg-zinc-500",
  envoye: "bg-blue-500",
  signe: "bg-emerald-500",
  refuse: "bg-red-500",
  // Factures
  envoyee: "bg-blue-500",
  payee: "bg-emerald-500",
  partiellement_payee: "bg-amber-500",
  en_retard: "bg-red-500",
};

const statutLabels: Record<string, string> = {
  en_projet: "En projet",
  validee: "Validée",
  en_cours: "En cours",
  terminee: "Terminée",
  brouillon: "Brouillon",
  envoye: "Envoyé",
  signe: "Signé",
  refuse: "Refusé",
  envoyee: "Envoyée",
  payee: "Payée",
  partiellement_payee: "Partielle",
  en_retard: "En retard",
};

// ─── Greeting helper ─────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

function formatDateLong(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

// ─── Async Server Components ─────────────────────────────

async function WelcomeHeader() {
  const user = await getCurrentUser();
  const prenom = user?.prenom || "là";
  const greeting = getGreeting();
  const dateStr = formatDateLong();

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
        {greeting}, {prenom}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground capitalize">
        {dateStr}
      </p>
    </div>
  );
}

async function HeroMetrics() {
  const data = await getDashboardData();
  if (!data) return null;

  const tauxEncaissement =
    data.caFacture > 0
      ? Math.round((data.caEncaisse / data.caFacture) * 100)
      : 0;

  const metrics = [
    {
      label: "Chiffre d'affaires",
      value: formatCurrency(data.caFacture),
      sub: `${formatCurrency(data.caEncaisse)} encaissé`,
      icon: Euro,
    },
    {
      label: "Sessions actives",
      value: String(data.sessionsActives),
      sub:
        data.sessionsActives === 0
          ? "Aucune session en cours"
          : data.sessionsActives === 1
          ? "1 session en cours ou validée"
          : `${data.sessionsActives} sessions en cours ou validées`,
      icon: Calendar,
    },
    {
      label: "Apprenants",
      value: String(data.apprenants),
      sub:
        tauxEncaissement > 0
          ? `Taux d'encaissement : ${tauxEncaissement}%`
          : "Aucune facture",
      icon: Users,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl border border-border bg-border overflow-hidden">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-card px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex items-center gap-2 mb-3">
            <metric.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {metric.label}
            </p>
          </div>
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">
            {metric.value}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground/60">
            {metric.sub}
          </p>
        </div>
      ))}
    </div>
  );
}

async function AttentionSection() {
  const data = await getDashboardData();
  if (!data) return null;

  const hasAlerts =
    data.facturesEnRetard.length > 0 || data.devisEnAttente.length > 0;
  if (!hasAlerts) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        Attention requise
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.facturesEnRetard.length > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
                Factures en retard
              </span>
              <span className="text-xs font-bold text-red-400">
                {data.facturesEnRetard.length}
              </span>
            </div>
            <div className="space-y-2">
              {data.facturesEnRetard.map((f) => (
                <Link
                  key={f.id}
                  href={`/factures/${f.id}`}
                  className="flex items-center justify-between gap-2 text-sm group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-muted-foreground/60">
                      {f.numero_affichage}
                    </span>
                    <span className="truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {(f.entreprises as { nom: string } | null)?.nom ||
                        f.objet ||
                        "—"}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-red-400 shrink-0">
                    {f.total_ttc ? formatCurrency(Number(f.total_ttc)) : "—"}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/factures?statut=en_retard"
              className="mt-3 flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 transition-colors"
            >
              Voir toutes les factures en retard
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {data.devisEnAttente.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Devis en attente
              </span>
              <span className="text-xs font-bold text-amber-400">
                {data.devisEnAttente.length}
              </span>
            </div>
            <div className="space-y-2">
              {data.devisEnAttente.map((d) => (
                <Link
                  key={d.id}
                  href={`/devis/${d.id}`}
                  className="flex items-center justify-between gap-2 text-sm group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-muted-foreground/60">
                      {d.numero_affichage}
                    </span>
                    <span className="truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {(d.entreprises as { nom: string } | null)?.nom ||
                        d.objet ||
                        "—"}
                    </span>
                  </div>
                  <span className="text-xs font-medium shrink-0">
                    {d.total_ttc ? formatCurrency(Number(d.total_ttc)) : "—"}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href="/devis?statut=envoye"
              className="mt-3 flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
            >
              Voir tous les devis en attente
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

async function UpcomingSessionsList() {
  const sessions = await getUpcomingSessions();

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Calendar className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/50">
          Aucune session planifiée
        </p>
        <Link
          href="/sessions"
          className="text-xs text-primary hover:underline"
        >
          Créer une session
        </Link>
      </div>
    );
  }

  // Group sessions by month
  const grouped = sessions.reduce<
    Record<string, typeof sessions>
  >((acc, session) => {
    if (!session.date_debut) return acc;
    const monthKey = new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
    }).format(new Date(session.date_debut));
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(session);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([month, monthSessions]) => (
        <div key={month}>
          <p className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-wider mb-2 px-3">
            {month}
          </p>
          <div className="space-y-0.5">
            {monthSessions.map((session) => {
              const dotColor =
                statutColors[session.statut] ?? "bg-zinc-500";
              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors group"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${dotColor} shrink-0`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">
                      {session.nom}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {session.numero_affichage}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {statutLabels[session.statut] ?? session.statut}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {session.date_debut && (
                      <p className="text-[12px] text-muted-foreground/70 tabular-nums">
                        {formatDate(session.date_debut)}
                      </p>
                    )}
                    {session.date_fin &&
                      session.date_fin !== session.date_debut && (
                        <p className="text-[10px] text-muted-foreground/40 tabular-nums">
                          → {formatDate(session.date_fin)}
                        </p>
                      )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

async function ActivityFeed() {
  const { devis, factures } = await getRecentActivity();

  // Merge and sort by created_at
  const items = [
    ...devis.map((d) => ({
      ...d,
      type: "devis" as const,
      label: d.objet || (d.entreprises as { nom: string } | null)?.nom || "Sans objet",
    })),
    ...factures.map((f) => ({
      ...f,
      type: "facture" as const,
      label: f.objet || (f.entreprises as { nom: string } | null)?.nom || "Sans objet",
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, 6);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground/50">
          Aucune activité récente
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const dotColor = statutColors[item.statut] ?? "bg-zinc-500";
        const href =
          item.type === "devis"
            ? `/devis/${item.id}`
            : `/factures/${item.id}`;
        const typeLabel = item.type === "devis" ? "Devis" : "Facture";
        const Icon = item.type === "devis" ? FileText : Receipt;

        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors group"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded bg-muted/30 shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate group-hover:text-primary transition-colors">
                <span className="text-muted-foreground/50 font-medium">
                  {typeLabel}
                </span>{" "}
                <span className="font-mono text-[11px] text-muted-foreground/40">
                  {item.numero_affichage}
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground/50 truncate mt-0.5">
                {item.label}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.total_ttc ? (
                <span className="text-[12px] font-medium tabular-nums">
                  {formatCurrency(Number(item.total_ttc))}
                </span>
              ) : null}
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                />
                <span className="text-[10px] text-muted-foreground/50">
                  {statutLabels[item.statut] ?? item.statut}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── Quick stats row (bottom) ────────────────────────────

async function QuickStatsRow() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, admin } = result;

  const [entreprisesRes, formationsRes, formateursRes] = await Promise.all([
    admin
      .from("entreprises")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
    admin
      .from("produits_formation")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
    admin
      .from("formateurs")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", organisationId)
      .is("archived_at", null),
  ]);

  const stats = [
    {
      label: "Entreprises",
      value: entreprisesRes.count ?? 0,
      href: "/entreprises",
    },
    {
      label: "Formations au catalogue",
      value: formationsRes.count ?? 0,
      href: "/produits",
    },
    {
      label: "Formateurs",
      value: formateursRes.count ?? 0,
      href: "/formateurs",
    },
  ];

  return (
    <div className="flex items-center gap-6 text-sm text-muted-foreground/60">
      {stats.map((stat, i) => (
        <Link
          key={stat.label}
          href={stat.href}
          className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
        >
          <span className="font-semibold text-foreground/80 group-hover:text-primary transition-colors">
            {stat.value}
          </span>
          <span className="text-xs">{stat.label}</span>
          {i < stats.length - 1 && (
            <span className="ml-4 text-border">·</span>
          )}
        </Link>
      ))}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome header */}
      <div className="flex items-end justify-between gap-4">
        <Suspense
          fallback={
            <div className="animate-pulse">
              <div className="h-7 w-48 rounded bg-muted/30 mb-2" />
              <div className="h-4 w-32 rounded bg-muted/20" />
            </div>
          }
        >
          <WelcomeHeader />
        </Suspense>
        <Link
          href="/indicateurs"
          className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          <TrendingUp className="h-3.5 w-3.5" />
          Indicateurs
        </Link>
      </div>

      {/* Hero metrics — 3 key numbers */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px rounded-xl border border-border bg-border overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-card px-5 py-5 sm:px-6 sm:py-6">
                <HeroMetricSkeleton />
              </div>
            ))}
          </div>
        }
      >
        <HeroMetrics />
      </Suspense>

      {/* Attention required — conditional */}
      <Suspense fallback={null}>
        <AttentionSection />
      </Suspense>

      {/* Two-column layout: Sessions + Activity feed */}
      <div className="grid gap-8 lg:grid-cols-5">
        {/* Prochaines sessions — left, wider */}
        <div className="lg:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/50" />
              Prochaines sessions
            </h2>
            <Link
              href="/sessions"
              className="text-[11px] text-muted-foreground/50 hover:text-primary flex items-center gap-1 transition-colors"
            >
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Suspense fallback={<div className="p-2"><SessionTimelineSkeleton /></div>}>
              <UpcomingSessionsList />
            </Suspense>
          </div>
        </div>

        {/* Activité récente — right, narrower */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-muted-foreground/50" />
              Activité récente
            </h2>
            <div className="flex items-center gap-3">
              <Link
                href="/devis"
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
              >
                Devis
              </Link>
              <Link
                href="/factures"
                className="text-[11px] text-muted-foreground/50 hover:text-primary transition-colors"
              >
                Factures
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Suspense fallback={<div className="p-2"><ActivityFeedSkeleton /></div>}>
              <ActivityFeed />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Quick stats footer */}
      <Suspense fallback={null}>
        <QuickStatsRow />
      </Suspense>
    </div>
  );
}
