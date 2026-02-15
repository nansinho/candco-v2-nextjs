import { Suspense } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { getOrganisationId, getCurrentUser } from "@/lib/auth-helpers";
import { WidgetGrid, type WidgetConfig } from "@/components/dashboard/widget-grid";
import {
  ChiffresWidget,
  StatsWidget,
  SessionsWidget,
  DevisWidget,
  FacturesWidget,
  AlertesWidget,
  SessionsActivesWidget,
  AccesRapidesWidget,
} from "@/components/dashboard/widgets";
import { TicketsWidget } from "@/components/dashboard/tickets-widget";
import { getTicketStats } from "@/actions/tickets";

// ─── Widget definitions ──────────────────────────────────

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "stats", title: "Vue d'ensemble", size: "medium", visible: true },
  { id: "chiffres", title: "Chiffres clés", size: "small", visible: true },
  { id: "sessions", title: "Prochaines sessions", size: "medium", visible: true },
  { id: "sessions-actives", title: "Sessions actives", size: "small", visible: true },
  { id: "alertes", title: "Alertes", size: "medium", visible: true },
  { id: "tickets", title: "Tickets support", size: "small", visible: true },
  { id: "acces-rapides", title: "Accès rapides", size: "small", visible: true },
  { id: "devis", title: "Derniers devis", size: "small", visible: true },
  { id: "factures", title: "Dernières factures", size: "medium", visible: true },
];

// ─── Data fetching ───────────────────────────────────────

async function getDashboardData() {
  const result = await getOrganisationId();
  if ("error" in result) return null;
  const { organisationId, admin } = result;

  const [
    apprenantsRes, entreprisesRes, sessionsActiveRes,
    formationsRes, formateursRes, facturesRes,
    devisEnAttenteRes, facturesEnRetardRes,
    upcomingSessionsRes, recentDevisRes, recentFacturesRes,
  ] = await Promise.all([
    admin.from("apprenants").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("entreprises").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).in("statut", ["en_cours", "validee"]).is("archived_at", null),
    admin.from("produits_formation").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("formateurs").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).is("archived_at", null),
    admin.from("factures").select("total_ttc, statut").eq("organisation_id", organisationId).is("archived_at", null),
    // Alertes
    admin.from("devis").select("id, numero_affichage, objet, total_ttc, entreprises(nom)").eq("organisation_id", organisationId).eq("statut", "envoye").is("archived_at", null).order("date_emission", { ascending: false }).limit(5),
    admin.from("factures").select("id, numero_affichage, objet, total_ttc, entreprises(nom)").eq("organisation_id", organisationId).eq("statut", "en_retard").is("archived_at", null).order("date_echeance", { ascending: true }).limit(5),
    // Lists
    admin.from("sessions").select("id, numero_affichage, nom, statut, date_debut, date_fin").eq("organisation_id", organisationId).is("archived_at", null).gte("date_debut", new Date().toISOString().split("T")[0]).order("date_debut", { ascending: true }).limit(6),
    admin.from("devis").select("id, numero_affichage, objet, statut, total_ttc, date_emission, entreprises(nom)").eq("organisation_id", organisationId).is("archived_at", null).order("created_at", { ascending: false }).limit(5),
    admin.from("factures").select("id, numero_affichage, objet, statut, total_ttc, date_emission, entreprises(nom)").eq("organisation_id", organisationId).is("archived_at", null).order("created_at", { ascending: false }).limit(5),
  ]);

  const factures = facturesRes.data ?? [];
  const caFacture = factures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
  const caEncaisse = factures.filter(f => f.statut === "payee").reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);

  // Fetch ticket stats in parallel
  const ticketStats = await getTicketStats();

  return {
    stats: {
      apprenants: apprenantsRes.count ?? 0,
      entreprises: entreprisesRes.count ?? 0,
      sessionsActives: sessionsActiveRes.count ?? 0,
      formations: formationsRes.count ?? 0,
      formateurs: formateursRes.count ?? 0,
      caFacture,
      caEncaisse,
      tauxEncaissement: caFacture > 0 ? Math.round((caEncaisse / caFacture) * 100) : 0,
    },
    devisEnAttente: ((devisEnAttenteRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      total_ttc: number | null; entreprises: { nom: string } | null;
    }>,
    facturesEnRetard: ((facturesEnRetardRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      total_ttc: number | null; entreprises: { nom: string } | null;
    }>,
    upcomingSessions: (upcomingSessionsRes.data ?? []) as Array<{
      id: string; numero_affichage: string | null; nom: string;
      statut: string; date_debut: string | null; date_fin: string | null;
    }>,
    recentDevis: ((recentDevisRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      statut: string; total_ttc: number | null; date_emission: string; entreprises: { nom: string } | null;
    }>,
    recentFactures: ((recentFacturesRes.data ?? []) as unknown) as Array<{
      id: string; numero_affichage: string | null; objet: string | null;
      statut: string; total_ttc: number | null; date_emission: string; entreprises: { nom: string } | null;
    }>,
    ticketStats,
  };
}

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
      <p className="text-xs text-muted-foreground/60 mt-0.5">
        {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      </p>
    </div>
  );
}

async function DashboardContent() {
  const data = await getDashboardData();
  if (!data) return null;

  const widgetContent: Record<string, React.ReactNode> = {
    "chiffres": <ChiffresWidget data={data.stats} />,
    "sessions-actives": <SessionsActivesWidget data={data.stats} />,
    "alertes": <AlertesWidget facturesEnRetard={data.facturesEnRetard} devisEnAttente={data.devisEnAttente} />,
    "stats": <StatsWidget data={data.stats} />,
    "acces-rapides": <AccesRapidesWidget />,
    "sessions": <SessionsWidget sessions={data.upcomingSessions} />,
    "devis": <DevisWidget devis={data.recentDevis} />,
    "factures": <FacturesWidget factures={data.recentFactures} />,
    "tickets": <TicketsWidget stats={data.ticketStats} />,
  };

  return (
    <WidgetGrid widgets={DEFAULT_WIDGETS} storageKey="candco-dashboard-layout">
      {widgetContent}
    </WidgetGrid>
  );
}

// ─── Skeleton ────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {[2, 1, 3, 2, 1, 2, 1, 2].map((span, i) => (
        <div
          key={i}
          className={`rounded-xl border border-border/50 bg-card animate-pulse ${
            span === 1 ? "col-span-1" : span === 2 ? "col-span-1 lg:col-span-2" : "col-span-1 lg:col-span-3"
          }`}
        >
          <div className="px-4 py-3 border-b border-border/30">
            <div className="h-3 w-24 rounded bg-muted/20" />
          </div>
          <div className="p-4 space-y-3">
            <div className="h-4 w-32 rounded bg-muted/20" />
            <div className="h-3 w-20 rounded bg-muted/15" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Suspense
          fallback={
            <div className="animate-pulse">
              <div className="h-5 w-40 rounded bg-muted/20 mb-1.5" />
              <div className="h-3 w-28 rounded bg-muted/15" />
            </div>
          }
        >
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

      {/* Widget grid */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
