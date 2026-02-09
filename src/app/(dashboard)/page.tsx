import { Suspense } from "react";
import Link from "next/link";
import {
  Calendar,
  ArrowRight,
  FileText,
  Receipt,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowUpRight,
  BookOpen,
  Building2,
  GraduationCap,
  UserCheck,
} from "lucide-react";
import { getOrganisationId, getCurrentUser } from "@/lib/auth-helpers";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Data fetching ───────────────────────────────────────

async function getDashboardData() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, admin } = result;

  const [
    apprenantsRes,
    entreprisesRes,
    sessionsActiveRes,
    formationsRes,
    formateursRes,
    facturesRes,
    devisEnAttenteRes,
    facturesEnRetardRes,
  ] = await Promise.all([
    admin.from("apprenants").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("entreprises").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).in("statut", ["en_cours", "validee"]).is("archived_at", null),
    admin.from("produits_formation").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("formateurs").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("factures").select("total_ttc, statut").eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("devis").select("id, numero_affichage, objet, total_ttc, date_emission, entreprises(nom)").eq("organisation_id", organisationId).eq("statut", "envoye").is("archived_at", null).order("date_emission", { ascending: false }).limit(5),
    admin.from("factures").select("id, numero_affichage, objet, total_ttc, date_echeance, entreprises(nom)").eq("organisation_id", organisationId).eq("statut", "en_retard").is("archived_at", null).order("date_echeance", { ascending: true }).limit(5),
  ]);

  const factures = facturesRes.data ?? [];
  const caFacture = factures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
  const caEncaisse = factures.filter((f) => f.statut === "payee").reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);

  return {
    apprenants: apprenantsRes.count ?? 0,
    entreprises: entreprisesRes.count ?? 0,
    sessionsActives: sessionsActiveRes.count ?? 0,
    formations: formationsRes.count ?? 0,
    formateurs: formateursRes.count ?? 0,
    caFacture,
    caEncaisse,
    tauxEncaissement: caFacture > 0 ? Math.round((caEncaisse / caFacture) * 100) : 0,
    devisEnAttente: ((devisEnAttenteRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      total_ttc: number | null; date_emission: string; entreprises: { nom: string } | null;
    }>,
    facturesEnRetard: ((facturesEnRetardRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      total_ttc: number | null; date_echeance: string | null; entreprises: { nom: string } | null;
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
    .select("id, numero_affichage, nom, statut, date_debut, date_fin")
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
    admin.from("devis").select("id, numero_affichage, objet, statut, total_ttc, created_at, entreprises(nom)").eq("organisation_id", organisationId).is("archived_at", null).order("created_at", { ascending: false }).limit(4),
    admin.from("factures").select("id, numero_affichage, objet, statut, total_ttc, created_at, entreprises(nom)").eq("organisation_id", organisationId).is("archived_at", null).order("created_at", { ascending: false }).limit(4),
  ]);

  return {
    devis: ((devisRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      statut: string; total_ttc: number | null; created_at: string; entreprises: { nom: string } | null;
    }>,
    factures: ((facturesRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      statut: string; total_ttc: number | null; created_at: string; entreprises: { nom: string } | null;
    }>,
  };
}

// ─── Status helpers ──────────────────────────────────────

const statutDot: Record<string, string> = {
  en_projet: "bg-amber-400", validee: "bg-blue-400", en_cours: "bg-emerald-400",
  terminee: "bg-zinc-400", brouillon: "bg-zinc-400", envoye: "bg-blue-400",
  signe: "bg-emerald-400", refuse: "bg-red-400", envoyee: "bg-blue-400",
  payee: "bg-emerald-400", partiellement_payee: "bg-amber-400", en_retard: "bg-red-400",
};

const statutLabel: Record<string, string> = {
  en_projet: "En projet", validee: "Validée", en_cours: "En cours",
  terminee: "Terminée", brouillon: "Brouillon", envoye: "Envoyé",
  signe: "Signé", refuse: "Refusé", envoyee: "Envoyée",
  payee: "Payée", partiellement_payee: "Partielle", en_retard: "En retard",
};

// ─── Greeting ────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

// ─── Server Components ───────────────────────────────────

async function WelcomeHeader() {
  const user = await getCurrentUser();
  const prenom = user?.prenom || "là";

  return (
    <div>
      <h1 className="text-lg font-medium">
        {getGreeting()}, {prenom}
      </h1>
      <p className="text-xs text-muted-foreground/50 mt-0.5">
        {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      </p>
    </div>
  );
}

async function Overview() {
  const data = await getDashboardData();
  if (!data) return null;

  return (
    <>
      {/* Metrics row — no cards, just numbers */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-6 gap-x-4 py-5 border-b border-border/40">
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {formatCurrency(data.caFacture)}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            CA facturé
          </p>
        </div>
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {formatCurrency(data.caEncaisse)}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            CA encaissé
          </p>
        </div>
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {data.tauxEncaissement}<span className="text-base font-normal text-muted-foreground/40">%</span>
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            Encaissement
          </p>
        </div>
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {data.sessionsActives}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            Sessions actives
          </p>
        </div>
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {data.apprenants}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            Apprenants
          </p>
        </div>
        <div>
          <p className="text-[22px] sm:text-[26px] font-semibold tracking-tight leading-none">
            {data.formations}
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1.5">
            Formations
          </p>
        </div>
      </div>

      {/* Alerts — only if needed */}
      {(data.facturesEnRetard.length > 0 || data.devisEnAttente.length > 0) && (
        <div className="flex flex-col sm:flex-row gap-4 py-4 border-b border-border/40">
          {data.facturesEnRetard.length > 0 && (
            <Link
              href="/factures?statut=en_retard"
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/10 hover:border-red-500/20 transition-colors group flex-1"
            >
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-red-400">
                  {data.facturesEnRetard.length} facture{data.facturesEnRetard.length > 1 ? "s" : ""} en retard
                </p>
                <p className="text-[11px] text-muted-foreground/50 truncate">
                  {data.facturesEnRetard.map(f => (f.entreprises as { nom: string } | null)?.nom || f.numero_affichage).filter(Boolean).join(", ")}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-red-400/50 group-hover:text-red-400 transition-colors shrink-0" />
            </Link>
          )}
          {data.devisEnAttente.length > 0 && (
            <Link
              href="/devis?statut=envoye"
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 transition-colors group flex-1"
            >
              <FileText className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-amber-400">
                  {data.devisEnAttente.length} devis en attente
                </p>
                <p className="text-[11px] text-muted-foreground/50 truncate">
                  {data.devisEnAttente.map(d => (d.entreprises as { nom: string } | null)?.nom || d.numero_affichage).filter(Boolean).join(", ")}
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-amber-400/50 group-hover:text-amber-400 transition-colors shrink-0" />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

async function UpcomingSessions() {
  const sessions = await getUpcomingSessions();

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/40 py-6">
        Aucune session planifiée.{" "}
        <Link href="/sessions" className="text-primary hover:underline">
          Créer une session
        </Link>
      </p>
    );
  }

  return (
    <div className="-mx-1">
      {sessions.map((session, i) => {
        const dot = statutDot[session.statut] ?? "bg-zinc-500";
        const prevDate = i > 0 ? sessions[i - 1].date_debut : null;
        const showDate = session.date_debut !== prevDate;

        return (
          <div key={session.id}>
            {showDate && session.date_debut && (
              <p className="text-[11px] text-muted-foreground/40 font-medium mt-4 first:mt-0 mb-1 px-1">
                {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(new Date(session.date_debut))}
              </p>
            )}
            <Link
              href={`/sessions/${session.id}`}
              className="flex items-center gap-2.5 rounded-md px-1 py-1.5 -mx-1 hover:bg-muted/20 transition-colors group"
            >
              <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0 mt-0.5`} />
              <span className="text-[13px] truncate flex-1 group-hover:text-primary transition-colors">
                {session.nom}
              </span>
              <span className="text-[11px] text-muted-foreground/30 font-mono shrink-0">
                {session.numero_affichage}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}

async function RecentActivity() {
  const { devis, factures } = await getRecentActivity();

  const items = [
    ...devis.map((d) => ({ ...d, type: "devis" as const })),
    ...factures.map((f) => ({ ...f, type: "facture" as const })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/40 py-6">
        Aucune activité récente.
      </p>
    );
  }

  return (
    <div className="-mx-1">
      {items.map((item) => {
        const dot = statutDot[item.statut] ?? "bg-zinc-500";
        const href = item.type === "devis" ? `/devis/${item.id}` : `/factures/${item.id}`;
        const label = item.objet || (item.entreprises as { nom: string } | null)?.nom || "—";

        return (
          <Link
            key={`${item.type}-${item.id}`}
            href={href}
            className="flex items-center gap-2.5 rounded-md px-1 py-1.5 -mx-1 hover:bg-muted/20 transition-colors group"
          >
            <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
            <span className="text-[11px] text-muted-foreground/40 shrink-0 w-14">
              {item.type === "devis" ? "Devis" : "Facture"}
            </span>
            <span className="text-[13px] truncate flex-1 group-hover:text-primary transition-colors">
              {label}
            </span>
            {item.total_ttc ? (
              <span className="text-[12px] text-muted-foreground/60 font-medium tabular-nums shrink-0">
                {formatCurrency(Number(item.total_ttc))}
              </span>
            ) : null}
            <span className="text-[10px] text-muted-foreground/30 shrink-0">
              {statutLabel[item.statut] ?? item.statut}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

async function QuickLinks() {
  const data = await getDashboardData();
  if (!data) return null;

  const links = [
    { label: "Apprenants", value: data.apprenants, href: "/apprenants", icon: GraduationCap },
    { label: "Entreprises", value: data.entreprises, href: "/entreprises", icon: Building2 },
    { label: "Formations", value: data.formations, href: "/produits", icon: BookOpen },
    { label: "Formateurs", value: data.formateurs, href: "/formateurs", icon: UserCheck },
  ];

  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors group"
        >
          <link.icon className="h-3 w-3" />
          <span className="font-medium text-foreground/60 group-hover:text-primary transition-colors">{link.value}</span>
          <span>{link.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-y-6 gap-x-4 py-5 border-b border-border/40 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i}>
          <div className="h-7 w-16 rounded bg-muted/30 mb-2" />
          <div className="h-3 w-14 rounded bg-muted/15" />
        </div>
      ))}
    </div>
  );
}

function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 animate-pulse" style={{ opacity: 1 - i * 0.2 }}>
          <div className="h-1.5 w-1.5 rounded-full bg-muted/30" />
          <div className="h-3.5 w-48 rounded bg-muted/20" />
          <div className="flex-1" />
          <div className="h-3 w-16 rounded bg-muted/15" />
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="max-w-5xl space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-6">
        <Suspense fallback={<div className="animate-pulse"><div className="h-5 w-40 rounded bg-muted/20 mb-1.5" /><div className="h-3 w-28 rounded bg-muted/15" /></div>}>
          <WelcomeHeader />
        </Suspense>
        <Link
          href="/indicateurs"
          className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          <TrendingUp className="h-3 w-3" />
          Indicateurs
        </Link>
      </div>

      {/* Overview: metrics + alerts */}
      <Suspense fallback={<MetricsSkeleton />}>
        <Overview />
      </Suspense>

      {/* Two columns: sessions + activity */}
      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-5 pt-6">
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
              Prochaines sessions
            </h2>
            <Link href="/sessions" className="text-[11px] text-muted-foreground/30 hover:text-primary flex items-center gap-1 transition-colors">
              Tout voir <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <Suspense fallback={<ListSkeleton />}>
            <UpcomingSessions />
          </Suspense>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xs font-medium text-muted-foreground/50 uppercase tracking-wider">
              Activité récente
            </h2>
            <div className="flex gap-2">
              <Link href="/devis" className="text-[11px] text-muted-foreground/30 hover:text-primary transition-colors">Devis</Link>
              <Link href="/factures" className="text-[11px] text-muted-foreground/30 hover:text-primary transition-colors">Factures</Link>
            </div>
          </div>
          <Suspense fallback={<ListSkeleton count={5} />}>
            <RecentActivity />
          </Suspense>
        </div>
      </div>

      {/* Footer links */}
      <div className="pt-8 pb-2 border-t border-border/20 mt-8">
        <Suspense fallback={null}>
          <QuickLinks />
        </Suspense>
      </div>
    </div>
  );
}
