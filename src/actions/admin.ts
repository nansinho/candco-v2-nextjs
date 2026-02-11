"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth-helpers";

// ─── Guard ────────────────────────────────────────────────
async function requireSuperAdmin() {
  const user = await getCurrentUser();
  if (!user?.is_super_admin) throw new Error("Accès non autorisé");
  return user;
}

// ─── Types ────────────────────────────────────────────────

export interface AdminDashboardStats {
  orgsCount: number;
  usersCount: number;
  sessionsCount: number;
  apprenantsCount: number;
  formateursCount: number;
  ticketsOuverts: number;
  ticketsUrgents: number;
}

export interface AdminOrgRow {
  id: string;
  nom: string;
  siret: string | null;
  nda: string | null;
  email: string | null;
  telephone: string | null;
  vitrine_active: boolean;
  created_at: string;
  users_count: number;
  sessions_count: number;
  apprenants_count: number;
}

export interface AdminOrgDetail {
  id: string;
  nom: string;
  siret: string | null;
  nda: string | null;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  logo_url: string | null;
  vitrine_active: boolean;
  sous_domaine: string | null;
  domaine_custom: string | null;
  created_at: string;
  updated_at: string;
  stats: {
    users: number;
    sessions: number;
    apprenants: number;
    formateurs: number;
    produits: number;
    tickets: number;
    extranet_acces: number;
  };
}

export interface AdminUserRow {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string;
  role: string;
  actif: boolean;
  organisation_id: string;
  organisation_nom: string;
  created_at: string;
}

export interface AdminTicketRow {
  id: string;
  numero_affichage: string | null;
  titre: string;
  statut: string;
  priorite: string;
  categorie: string | null;
  auteur_nom: string | null;
  auteur_type: string;
  organisation_id: string;
  organisation_nom: string;
  created_at: string;
}

export interface AdminActivityRow {
  id: string;
  created_at: string;
  module: string;
  action: string;
  description: string | null;
  user_nom: string | null;
  user_role: string | null;
  origine: string;
  entite_label: string | null;
  objet_href: string | null;
  organisation_id: string;
  agence_nom: string | null;
}

// ─── Dashboard Stats ──────────────────────────────────────

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const [orgs, users, sessions, apprenants, formateurs, ticketsOpen, ticketsUrgent] =
    await Promise.all([
      admin.from("organisations").select("id", { count: "exact", head: true }),
      admin.from("utilisateurs").select("id", { count: "exact", head: true }),
      admin.from("sessions").select("id", { count: "exact", head: true }),
      admin.from("apprenants").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("formateurs").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("tickets").select("id", { count: "exact", head: true }).in("statut", ["ouvert", "en_cours", "en_attente"]),
      admin.from("tickets").select("id", { count: "exact", head: true }).eq("priorite", "urgente").in("statut", ["ouvert", "en_cours", "en_attente"]),
    ]);

  return {
    orgsCount: orgs.count || 0,
    usersCount: users.count || 0,
    sessionsCount: sessions.count || 0,
    apprenantsCount: apprenants.count || 0,
    formateursCount: formateurs.count || 0,
    ticketsOuverts: ticketsOpen.count || 0,
    ticketsUrgents: ticketsUrgent.count || 0,
  };
}

// ─── Recent Activity ──────────────────────────────────────

export async function getAdminRecentActivity(limit: number = 15): Promise<AdminActivityRow[]> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("historique_events")
    .select("id, created_at, module, action, description, user_nom, user_role, origine, entite_label, objet_href, organisation_id, agence_nom")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []) as AdminActivityRow[];
}

// ─── Recent Organisations ─────────────────────────────────

export async function getAdminRecentOrgs(limit: number = 5) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: orgs } = await admin
    .from("organisations")
    .select("id, nom, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!orgs || orgs.length === 0) return [];

  // Batch: get all users for these orgs in one query instead of N individual count queries
  const orgIds = orgs.map((o: { id: string }) => o.id);
  const { data: users } = await admin
    .from("utilisateurs")
    .select("organisation_id")
    .in("organisation_id", orgIds);

  const userCounts = new Map<string, number>();
  for (const u of (users ?? []) as { organisation_id: string }[]) {
    userCounts.set(u.organisation_id, (userCounts.get(u.organisation_id) || 0) + 1);
  }

  return orgs.map((org: { id: string; nom: string; created_at: string }) => ({
    ...org,
    users_count: userCounts.get(org.id) || 0,
  }));
}

// ─── Top Organisations by usage ───────────────────────────

export async function getAdminTopOrgs(limit: number = 5) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // Use RPC-style grouped counts instead of N+1 queries per org.
  // Fetch all sessions and apprenants grouped by organisation_id in 2 queries total.
  const [orgsRes, sessionsRes, apprenantsRes] = await Promise.all([
    admin.from("organisations").select("id, nom"),
    admin.from("sessions").select("organisation_id"),
    admin.from("apprenants").select("organisation_id").is("archived_at", null),
  ]);

  const orgs = orgsRes.data;
  if (!orgs || orgs.length === 0) return [];

  // Count in JS instead of N individual count queries
  const sessionCounts = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    sessionCounts.set(s.organisation_id, (sessionCounts.get(s.organisation_id) || 0) + 1);
  }
  const apprenantCounts = new Map<string, number>();
  for (const a of apprenantsRes.data ?? []) {
    apprenantCounts.set(a.organisation_id, (apprenantCounts.get(a.organisation_id) || 0) + 1);
  }

  return orgs
    .map((org: { id: string; nom: string }) => ({
      ...org,
      sessions_count: sessionCounts.get(org.id) || 0,
      apprenants_count: apprenantCounts.get(org.id) || 0,
    }))
    .sort((a: { sessions_count: number; apprenants_count: number }, b: { sessions_count: number; apprenants_count: number }) =>
      (b.sessions_count + b.apprenants_count) - (a.sessions_count + a.apprenants_count))
    .slice(0, limit);
}

// ─── Recent Tickets ───────────────────────────────────────

export async function getAdminRecentTickets(limit: number = 5) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("tickets")
    .select("id, numero_affichage, titre, statut, priorite, auteur_nom, organisation_id, organisations(nom), created_at")
    .in("statut", ["ouvert", "en_cours", "en_attente"])
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((t) => ({
    ...t,
    organisation_nom: (t.organisations as unknown as { nom: string } | null)?.nom || "—",
  }));
}

// ─── Organisations List ───────────────────────────────────

export async function getAdminOrganisations(
  page: number = 1,
  search: string = "",
  perPage: number = 25
): Promise<{ data: AdminOrgRow[]; count: number }> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  // Get all orgs with search filter
  let query = admin
    .from("organisations")
    .select("id, nom, siret, nda, email, telephone, vitrine_active, created_at", { count: "exact" });

  if (search) {
    query = query.or(`nom.ilike.%${search}%,siret.ilike.%${search}%,email.ilike.%${search}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data: orgs, count } = await query;

  if (!orgs || orgs.length === 0) return { data: [], count: 0 };

  // Batch: get counts for the page's orgs in 3 queries instead of 3×N
  const orgIds = orgs.map((o: { id: string }) => o.id);
  const [usersRes, sessionsRes, apprenantsRes] = await Promise.all([
    admin.from("utilisateurs").select("organisation_id").in("organisation_id", orgIds),
    admin.from("sessions").select("organisation_id").in("organisation_id", orgIds),
    admin.from("apprenants").select("organisation_id").in("organisation_id", orgIds).is("archived_at", null),
  ]);

  const userCounts = new Map<string, number>();
  for (const u of usersRes.data ?? []) {
    userCounts.set(u.organisation_id, (userCounts.get(u.organisation_id) || 0) + 1);
  }
  const sessionCounts = new Map<string, number>();
  for (const s of sessionsRes.data ?? []) {
    sessionCounts.set(s.organisation_id, (sessionCounts.get(s.organisation_id) || 0) + 1);
  }
  const apprenantCounts = new Map<string, number>();
  for (const a of apprenantsRes.data ?? []) {
    apprenantCounts.set(a.organisation_id, (apprenantCounts.get(a.organisation_id) || 0) + 1);
  }

  const withCounts = orgs.map((org: { id: string }) => ({
    ...org,
    users_count: userCounts.get(org.id) || 0,
    sessions_count: sessionCounts.get(org.id) || 0,
    apprenants_count: apprenantCounts.get(org.id) || 0,
  } as AdminOrgRow));

  return { data: withCounts, count: count || 0 };
}

// ─── Organisation Detail ──────────────────────────────────

export async function getAdminOrganisation(id: string): Promise<AdminOrgDetail | null> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organisations")
    .select("*")
    .eq("id", id)
    .single();

  if (!org) return null;

  const [usersRes, sessionsRes, apprenantsRes, formateursRes, produitsRes, ticketsRes, extranetRes] =
    await Promise.all([
      admin.from("utilisateurs").select("id", { count: "exact", head: true }).eq("organisation_id", id),
      admin.from("sessions").select("id", { count: "exact", head: true }).eq("organisation_id", id),
      admin.from("apprenants").select("id", { count: "exact", head: true }).eq("organisation_id", id).is("archived_at", null),
      admin.from("formateurs").select("id", { count: "exact", head: true }).eq("organisation_id", id).is("archived_at", null),
      admin.from("produits_formation").select("id", { count: "exact", head: true }).eq("organisation_id", id).is("archived_at", null),
      admin.from("tickets").select("id", { count: "exact", head: true }).eq("organisation_id", id),
      admin.from("extranet_acces").select("id", { count: "exact", head: true }).eq("organisation_id", id),
    ]);

  return {
    id: org.id,
    nom: org.nom,
    siret: org.siret,
    nda: org.nda,
    email: org.email,
    telephone: org.telephone,
    adresse_rue: org.adresse_rue,
    adresse_complement: org.adresse_complement,
    adresse_cp: org.adresse_cp,
    adresse_ville: org.adresse_ville,
    logo_url: org.logo_url,
    vitrine_active: org.vitrine_active ?? false,
    sous_domaine: org.sous_domaine,
    domaine_custom: org.domaine_custom,
    created_at: org.created_at,
    updated_at: org.updated_at,
    stats: {
      users: usersRes.count || 0,
      sessions: sessionsRes.count || 0,
      apprenants: apprenantsRes.count || 0,
      formateurs: formateursRes.count || 0,
      produits: produitsRes.count || 0,
      tickets: ticketsRes.count || 0,
      extranet_acces: extranetRes.count || 0,
    },
  };
}

// ─── Organisation Users ───────────────────────────────────

export async function getAdminOrgUsers(orgId: string) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("utilisateurs")
    .select("id, prenom, nom, email, role, actif, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  return data || [];
}

// ─── Organisation Sessions ────────────────────────────────

export async function getAdminOrgSessions(orgId: string) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("sessions")
    .select("id, numero_affichage, nom, statut, date_debut, date_fin, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data || [];
}

// ─── Organisation Extranet Access ─────────────────────────

export async function getAdminOrgExtranet(orgId: string) {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("extranet_acces")
    .select("id, user_id, role, entite_type, entite_id, statut, created_at")
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false });

  return data || [];
}

// ─── All Users (cross-org) ────────────────────────────────

export async function getAdminUsers(
  page: number = 1,
  search: string = "",
  perPage: number = 25
): Promise<{ data: AdminUserRow[]; count: number }> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("utilisateurs")
    .select("id, prenom, nom, email, role, actif, organisation_id, organisations(nom), created_at", { count: "exact" });

  if (search) {
    query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,email.ilike.%${search}%`);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, count } = await query;

  const rows: AdminUserRow[] = (data || []).map((u) => ({
    id: u.id,
    prenom: u.prenom,
    nom: u.nom,
    email: u.email,
    role: u.role,
    actif: u.actif,
    organisation_id: u.organisation_id,
    organisation_nom: (u.organisations as unknown as { nom: string } | null)?.nom || "—",
    created_at: u.created_at,
  }));

  return { data: rows, count: count || 0 };
}

// ─── All Tickets (cross-org) ──────────────────────────────

export async function getAdminTickets(
  page: number = 1,
  search: string = "",
  filters: { statut?: string; priorite?: string } = {},
  perPage: number = 25
): Promise<{ data: AdminTicketRow[]; count: number }> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("tickets")
    .select("id, numero_affichage, titre, statut, priorite, categorie, auteur_nom, auteur_type, organisation_id, organisations(nom), created_at", { count: "exact" });

  if (search) {
    query = query.or(`titre.ilike.%${search}%,numero_affichage.ilike.%${search}%,auteur_nom.ilike.%${search}%`);
  }
  if (filters.statut) {
    query = query.eq("statut", filters.statut);
  }
  if (filters.priorite) {
    query = query.eq("priorite", filters.priorite);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, count } = await query;

  const rows: AdminTicketRow[] = (data || []).map((t) => ({
    id: t.id,
    numero_affichage: t.numero_affichage,
    titre: t.titre,
    statut: t.statut,
    priorite: t.priorite,
    categorie: t.categorie,
    auteur_nom: t.auteur_nom,
    auteur_type: t.auteur_type,
    organisation_id: t.organisation_id,
    organisation_nom: (t.organisations as unknown as { nom: string } | null)?.nom || "—",
    created_at: t.created_at,
  }));

  return { data: rows, count: count || 0 };
}

// ─── Activity Log (cross-org) ─────────────────────────────

export async function getAdminActivity(
  page: number = 1,
  filters: { module?: string; orgId?: string } = {},
  perPage: number = 50
): Promise<{ data: AdminActivityRow[]; count: number }> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  let query = admin
    .from("historique_events")
    .select("id, created_at, module, action, description, user_nom, user_role, origine, entite_label, objet_href, organisation_id, agence_nom", { count: "exact" });

  if (filters.module) {
    query = query.eq("module", filters.module);
  }
  if (filters.orgId) {
    query = query.eq("organisation_id", filters.orgId);
  }

  query = query
    .order("created_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  const { data, count } = await query;

  return { data: (data || []) as AdminActivityRow[], count: count || 0 };
}

// ─── All organisations for dropdowns ──────────────────────

export async function getAdminOrgsList(): Promise<{ id: string; nom: string }[]> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("organisations")
    .select("id, nom")
    .order("nom");

  return data || [];
}
