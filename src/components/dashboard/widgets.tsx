import Link from "next/link";
import {
  Calendar,
  ArrowRight,
  FileText,
  Receipt,
  AlertTriangle,
  GraduationCap,
  Building2,
  BookOpen,
  UserCheck,
  TrendingUp,
  ArrowUpRight,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface StatsData {
  apprenants: number;
  entreprises: number;
  sessionsActives: number;
  formations: number;
  formateurs: number;
  caFacture: number;
  caEncaisse: number;
  tauxEncaissement: number;
}

interface SessionItem {
  id: string;
  numero_affichage: string | null;
  nom: string;
  statut: string;
  date_debut: string | null;
  date_fin: string | null;
}

interface DevisItem {
  id: string;
  numero_affichage: string | null;
  objet: string | null;
  statut: string;
  total_ttc: number | null;
  date_emission: string;
  entreprises: { nom: string } | null;
}

interface FactureItem {
  id: string;
  numero_affichage: string | null;
  objet: string | null;
  statut: string;
  total_ttc: number | null;
  date_emission: string;
  entreprises: { nom: string } | null;
}

interface AlertItem {
  id: string;
  numero_affichage: string | null;
  objet: string | null;
  total_ttc: number | null;
  entreprises: { nom: string } | null;
}

// ─── Status helpers ──────────────────────────────────────

const statusDot: Record<string, string> = {
  en_projet: "bg-amber-400", validee: "bg-blue-400", en_cours: "bg-emerald-400",
  terminee: "bg-zinc-400", brouillon: "bg-zinc-400", envoye: "bg-blue-400",
  signe: "bg-emerald-400", refuse: "bg-red-400", envoyee: "bg-blue-400",
  payee: "bg-emerald-400", partiellement_payee: "bg-amber-400", en_retard: "bg-red-400",
};

const statusLabel: Record<string, string> = {
  en_projet: "En projet", validee: "Validée", en_cours: "En cours",
  terminee: "Terminée", brouillon: "Brouillon", envoye: "Envoyé",
  signe: "Signé", refuse: "Refusé", envoyee: "Envoyée",
  payee: "Payée", partiellement_payee: "Partielle", en_retard: "En retard",
};

// ─── Widget: Chiffres clés ───────────────────────────────

export function ChiffresWidget({ data }: { data: StatsData }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div>
        <p className="text-lg sm:text-xl font-semibold tracking-tight leading-none">
          {formatCurrency(data.caFacture)}
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-1">CA facturé</p>
      </div>
      <div>
        <p className="text-lg sm:text-xl font-semibold tracking-tight leading-none">
          {formatCurrency(data.caEncaisse)}
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-1">Encaissé</p>
      </div>
      <div>
        <p className="text-lg sm:text-xl font-semibold tracking-tight leading-none">
          {data.tauxEncaissement}
          <span className="text-sm font-normal text-muted-foreground/40">%</span>
        </p>
        <p className="text-[11px] text-muted-foreground/50 mt-1">Encaissement</p>
      </div>
    </div>
  );
}

// ─── Widget: Stats rapides ───────────────────────────────

export function StatsWidget({ data }: { data: StatsData }) {
  const items = [
    { label: "Apprenants", value: data.apprenants, href: "/apprenants", icon: GraduationCap, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Entreprises", value: data.entreprises, href: "/entreprises", icon: Building2, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Formations", value: data.formations, href: "/produits", icon: BookOpen, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Formateurs", value: data.formateurs, href: "/formateurs", icon: UserCheck, color: "text-cyan-400", bg: "bg-cyan-400/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-muted/20 transition-colors group"
        >
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.bg} shrink-0`}>
            <item.icon className={`h-4 w-4 ${item.color}`} />
          </div>
          <div>
            <p className="text-base font-semibold leading-none">{item.value}</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">{item.label}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Widget: Sessions à venir ────────────────────────────

export function SessionsWidget({ sessions }: { sessions: SessionItem[] }) {
  if (sessions.length === 0) {
    return (
      <div className="flex items-center gap-3 py-1">
        <Calendar className="h-4 w-4 text-muted-foreground/20 shrink-0" />
        <p className="text-xs text-muted-foreground/40">
          Aucune session planifiée.{" "}
          <Link href="/sessions" className="text-primary hover:underline">Créer</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {sessions.map((session) => {
        const dot = statusDot[session.statut] ?? "bg-zinc-500";
        return (
          <Link
            key={session.id}
            href={`/sessions/${session.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20 transition-colors group"
          >
            <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] truncate group-hover:text-primary transition-colors">
                {session.nom}
              </p>
            </div>
            <span className="text-[11px] text-muted-foreground/40 tabular-nums shrink-0">
              {session.date_debut ? formatDate(session.date_debut) : "—"}
            </span>
          </Link>
        );
      })}
      <Link
        href="/sessions"
        className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground/30 hover:text-primary transition-colors pt-1"
      >
        Tout voir <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Widget: Derniers devis ──────────────────────────────

export function DevisWidget({ devis }: { devis: DevisItem[] }) {
  if (devis.length === 0) {
    return (
      <div className="flex items-center gap-3 py-1">
        <FileText className="h-4 w-4 text-muted-foreground/20 shrink-0" />
        <p className="text-xs text-muted-foreground/40">
          Aucun devis.{" "}
          <Link href="/devis" className="text-primary hover:underline">Créer</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {devis.map((d) => {
        const dot = statusDot[d.statut] ?? "bg-zinc-500";
        return (
          <Link
            key={d.id}
            href={`/devis/${d.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20 transition-colors group"
          >
            <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
            <span className="font-mono text-[10px] text-muted-foreground/30 shrink-0">
              {d.numero_affichage}
            </span>
            <span className="text-[13px] truncate flex-1 group-hover:text-primary transition-colors">
              {d.objet || (d.entreprises as { nom: string } | null)?.nom || "—"}
            </span>
            {d.total_ttc ? (
              <span className="text-[11px] text-muted-foreground/50 font-medium tabular-nums shrink-0">
                {formatCurrency(Number(d.total_ttc))}
              </span>
            ) : null}
          </Link>
        );
      })}
      <Link
        href="/devis"
        className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground/30 hover:text-primary transition-colors pt-1"
      >
        Tout voir <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Widget: Dernières factures ──────────────────────────

export function FacturesWidget({ factures }: { factures: FactureItem[] }) {
  if (factures.length === 0) {
    return (
      <div className="flex items-center gap-3 py-1">
        <Receipt className="h-4 w-4 text-muted-foreground/20 shrink-0" />
        <p className="text-xs text-muted-foreground/40">
          Aucune facture.{" "}
          <Link href="/factures" className="text-primary hover:underline">Créer</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {factures.map((f) => {
        const dot = statusDot[f.statut] ?? "bg-zinc-500";
        return (
          <Link
            key={f.id}
            href={`/factures/${f.id}`}
            className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/20 transition-colors group"
          >
            <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
            <span className="font-mono text-[10px] text-muted-foreground/30 shrink-0">
              {f.numero_affichage}
            </span>
            <span className="text-[13px] truncate flex-1 group-hover:text-primary transition-colors">
              {f.objet || (f.entreprises as { nom: string } | null)?.nom || "—"}
            </span>
            {f.total_ttc ? (
              <span className="text-[11px] text-muted-foreground/50 font-medium tabular-nums shrink-0">
                {formatCurrency(Number(f.total_ttc))}
              </span>
            ) : null}
          </Link>
        );
      })}
      <Link
        href="/factures"
        className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground/30 hover:text-primary transition-colors pt-1"
      >
        Tout voir <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ─── Widget: Alertes ─────────────────────────────────────

export function AlertesWidget({
  facturesEnRetard,
  devisEnAttente,
}: {
  facturesEnRetard: AlertItem[];
  devisEnAttente: AlertItem[];
}) {
  if (facturesEnRetard.length === 0 && devisEnAttente.length === 0) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <p className="text-sm text-muted-foreground/60">Aucune alerte en cours</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {facturesEnRetard.length > 0 && (
        <Link
          href="/factures?statut=en_retard"
          className="flex items-center gap-3 rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2.5 hover:border-red-500/20 transition-colors group"
        >
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-red-400">
              {facturesEnRetard.length} facture{facturesEnRetard.length > 1 ? "s" : ""} en retard
            </p>
            <p className="text-[11px] text-muted-foreground/40 truncate">
              {facturesEnRetard.map(f => (f.entreprises as { nom: string } | null)?.nom || f.numero_affichage).filter(Boolean).join(", ")}
            </p>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 text-red-400/40 group-hover:text-red-400 transition-colors shrink-0" />
        </Link>
      )}
      {devisEnAttente.length > 0 && (
        <Link
          href="/devis?statut=envoye"
          className="flex items-center gap-3 rounded-lg bg-amber-500/5 border border-amber-500/10 px-3 py-2.5 hover:border-amber-500/20 transition-colors group"
        >
          <FileText className="h-4 w-4 text-amber-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-amber-400">
              {devisEnAttente.length} devis en attente
            </p>
            <p className="text-[11px] text-muted-foreground/40 truncate">
              {devisEnAttente.map(d => (d.entreprises as { nom: string } | null)?.nom || d.numero_affichage).filter(Boolean).join(", ")}
            </p>
          </div>
          <ArrowUpRight className="h-3.5 w-3.5 text-amber-400/40 group-hover:text-amber-400 transition-colors shrink-0" />
        </Link>
      )}
    </div>
  );
}

// ─── Widget: Activité sessions ───────────────────────────

export function SessionsActivesWidget({ data }: { data: StatsData }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-3xl font-bold tracking-tight">{data.sessionsActives}</p>
        <p className="text-xs text-muted-foreground/50 mt-1">
          session{data.sessionsActives !== 1 ? "s" : ""} en cours
        </p>
      </div>
      <Link
        href="/sessions"
        className="flex items-center gap-1.5 rounded-lg border border-border/40 px-3 py-1.5 text-xs text-muted-foreground/50 hover:text-primary hover:border-primary/30 transition-colors"
      >
        <Calendar className="h-3 w-3" />
        Sessions
      </Link>
    </div>
  );
}

// ─── Widget: Accès rapides ───────────────────────────────

export function AccesRapidesWidget() {
  const links = [
    { label: "Nouvel apprenant", href: "/apprenants", icon: GraduationCap },
    { label: "Nouvelle entreprise", href: "/entreprises", icon: Building2 },
    { label: "Nouvelle session", href: "/sessions", icon: Calendar },
    { label: "Nouveau devis", href: "/devis", icon: FileText },
    { label: "Nouvelle facture", href: "/factures", icon: Receipt },
    { label: "Indicateurs", href: "/indicateurs", icon: TrendingUp },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {links.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground/60 hover:text-foreground hover:bg-muted/20 transition-colors group"
        >
          <link.icon className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
          <span>{link.label}</span>
        </Link>
      ))}
    </div>
  );
}
