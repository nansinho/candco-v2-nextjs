"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Building2,
  Users,
  Calendar,
  GraduationCap,
  UserCheck,
  BookOpen,
  LifeBuoy,
  Globe,
  ArrowLeft,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getAdminOrganisation,
  getAdminOrgUsers,
  getAdminOrgSessions,
  getAdminOrgExtranet,
  type AdminOrgDetail,
} from "@/actions/admin";
import { switchOrganisation } from "@/lib/auth-actions";
import { formatDate } from "@/lib/utils";

// ─── Tabs ────────────────────────────────────────────────

type Tab = "overview" | "utilisateurs" | "sessions" | "extranet" | "stats";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Vue d'ensemble" },
  { key: "utilisateurs", label: "Utilisateurs" },
  { key: "sessions", label: "Sessions" },
  { key: "extranet", label: "Extranet" },
  { key: "stats", label: "Statistiques" },
];

// ─── Role badge colors ───────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  manager: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  user: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const SESSION_STATUT_COLORS: Record<string, string> = {
  en_projet: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  validee: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  en_cours: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  terminee: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  archivee: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

const EXTRANET_ROLE_COLORS: Record<string, string> = {
  formateur: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  apprenant: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  contact_client: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

const EXTRANET_STATUT_COLORS: Record<string, string> = {
  invite: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  en_attente: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  actif: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  desactive: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

// ─── Page ────────────────────────────────────────────────

export default function AdminOrgDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;

  const [org, setOrg] = React.useState<AdminOrgDetail | null>(null);
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [isLoading, setIsLoading] = React.useState(true);
  const [switching, setSwitching] = React.useState(false);

  // Tab data
  const [users, setUsers] = React.useState<{ id: string; prenom: string | null; nom: string | null; email: string; role: string; actif: boolean; created_at: string }[]>([]);
  const [sessions, setSessions] = React.useState<{ id: string; numero_affichage: string | null; nom: string; statut: string; date_debut: string | null; date_fin: string | null; created_at: string }[]>([]);
  const [extranet, setExtranet] = React.useState<{ id: string; user_id: string | null; role: string; entite_type: string; statut: string; created_at: string }[]>([]);
  const [tabLoaded, setTabLoaded] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await getAdminOrganisation(orgId);
      setOrg(data);
      setIsLoading(false);
    }
    load();
  }, [orgId]);

  // Load tab data on demand
  React.useEffect(() => {
    if (tabLoaded[activeTab]) return;
    async function loadTab() {
      if (activeTab === "utilisateurs") {
        const data = await getAdminOrgUsers(orgId);
        setUsers(data);
      } else if (activeTab === "sessions") {
        const data = await getAdminOrgSessions(orgId);
        setSessions(data);
      } else if (activeTab === "extranet") {
        const data = await getAdminOrgExtranet(orgId);
        setExtranet(data);
      }
      setTabLoaded((prev) => ({ ...prev, [activeTab]: true }));
    }
    if (activeTab !== "overview" && activeTab !== "stats") {
      loadTab();
    }
  }, [activeTab, orgId, tabLoaded]);

  async function handleSwitch() {
    setSwitching(true);
    await switchOrganisation(orgId);
    window.location.href = "/";
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <p className="text-muted-foreground">Organisation introuvable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push("/admin/organisations")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Building2 className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{org.nom}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {org.siret && <span>SIRET : {org.siret}</span>}
                {org.nda && <span>NDA : {org.nda}</span>}
                {org.vitrine_active && (
                  <Badge variant="success" className="gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    Vitrine active
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={handleSwitch} disabled={switching} className="shrink-0">
          <ExternalLink className="h-4 w-4 mr-1" />
          {switching ? "Connexion..." : "Se connecter en tant que"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Info card */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Informations générales</h3>
            <div className="space-y-3">
              {org.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground/40" />
                  <span>{org.email}</span>
                </div>
              )}
              {org.telephone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground/40" />
                  <span>{org.telephone}</span>
                </div>
              )}
              {(org.adresse_rue || org.adresse_ville) && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground/40 mt-0.5" />
                  <div>
                    {org.adresse_rue && <p>{org.adresse_rue}</p>}
                    {org.adresse_complement && <p>{org.adresse_complement}</p>}
                    {(org.adresse_cp || org.adresse_ville) && (
                      <p>{[org.adresse_cp, org.adresse_ville].filter(Boolean).join(" ")}</p>
                    )}
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-border/30 space-y-1 text-xs text-muted-foreground">
                <p>Inscrit le {formatDate(org.created_at)}</p>
                <p>Dernière MAJ : {formatDate(org.updated_at)}</p>
              </div>
            </div>
          </div>

          {/* Quick stats card */}
          <div className="rounded-xl border border-border/50 bg-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Statistiques rapides</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Utilisateurs", value: org.stats.users, icon: Users, color: "text-violet-400" },
                { label: "Sessions", value: org.stats.sessions, icon: Calendar, color: "text-emerald-400" },
                { label: "Apprenants", value: org.stats.apprenants, icon: GraduationCap, color: "text-amber-400" },
                { label: "Formateurs", value: org.stats.formateurs, icon: UserCheck, color: "text-cyan-400" },
                { label: "Produits", value: org.stats.produits, icon: BookOpen, color: "text-pink-400" },
                { label: "Tickets", value: org.stats.tickets, icon: LifeBuoy, color: "text-orange-400" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2 rounded-lg border border-border/30 px-3 py-2">
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <div>
                    <p className="text-lg font-bold leading-none">{stat.value}</p>
                    <p className="text-xs text-muted-foreground/60">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "utilisateurs" && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground/60 text-xs">
                <th className="text-left px-4 py-3 font-medium">Nom</th>
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Rôle</th>
                <th className="text-left px-4 py-3 font-medium">Actif</th>
                <th className="text-left px-4 py-3 font-medium">Inscrit le</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium">{u.prenom} {u.nom}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={ROLE_COLORS[u.role] || ""}>{u.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.actif ? (
                      <span className="text-emerald-400 text-xs font-medium">Actif</span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">Inactif</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground/40">
                    Aucun utilisateur
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground/60 text-xs">
                <th className="text-left px-4 py-3 font-medium">ID</th>
                <th className="text-left px-4 py-3 font-medium">Nom</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Début</th>
                <th className="text-left px-4 py-3 font-medium">Fin</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.numero_affichage || "—"}</td>
                  <td className="px-4 py-3 font-medium">{s.nom}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={SESSION_STATUT_COLORS[s.statut] || ""}>{s.statut}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.date_debut ? formatDate(s.date_debut) : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{s.date_fin ? formatDate(s.date_fin) : "—"}</td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground/40">
                    Aucune session
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "extranet" && (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground/60 text-xs">
                <th className="text-left px-4 py-3 font-medium">Rôle</th>
                <th className="text-left px-4 py-3 font-medium">Type d&apos;entité</th>
                <th className="text-left px-4 py-3 font-medium">Statut</th>
                <th className="text-left px-4 py-3 font-medium">Créé le</th>
              </tr>
            </thead>
            <tbody>
              {extranet.map((e) => (
                <tr key={e.id} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={EXTRANET_ROLE_COLORS[e.role] || ""}>{e.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{e.entite_type}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={EXTRANET_STATUT_COLORS[e.statut] || ""}>{e.statut}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(e.created_at)}</td>
                </tr>
              ))}
              {extranet.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground/40">
                    Aucun accès extranet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-border/20 text-xs text-muted-foreground/40">
            {org.stats.extranet_acces} accès au total
          </div>
        </div>
      )}

      {activeTab === "stats" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Utilisateurs back-office", value: org.stats.users, icon: Users, color: "text-violet-400" },
            { label: "Sessions de formation", value: org.stats.sessions, icon: Calendar, color: "text-emerald-400" },
            { label: "Apprenants inscrits", value: org.stats.apprenants, icon: GraduationCap, color: "text-amber-400" },
            { label: "Formateurs", value: org.stats.formateurs, icon: UserCheck, color: "text-cyan-400" },
            { label: "Produits de formation", value: org.stats.produits, icon: BookOpen, color: "text-pink-400" },
            { label: "Tickets", value: org.stats.tickets, icon: LifeBuoy, color: "text-orange-400" },
            { label: "Accès extranet", value: org.stats.extranet_acces, icon: Globe, color: "text-blue-400" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border/50 bg-card p-4 flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground/60">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
