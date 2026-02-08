"use server";

import { getOrganisationId } from "@/lib/auth-helpers";

// ─── Types ──────────────────────────────────────────────

export interface HistoriqueEvent {
  id: string;
  date: string;
  module: HistoriqueModule;
  type_action: string;
  description: string;
  objet_label: string | null;
  objet_id: string | null;
  objet_href: string | null;
  utilisateur: string | null;
  origine: "backoffice" | "extranet" | "systeme";
  agence: string | null;
}

export type HistoriqueModule =
  | "activite"
  | "session"
  | "inscription"
  | "apprenant"
  | "contact"
  | "organisation"
  | "tache";

export interface HistoriqueFilters {
  module?: HistoriqueModule;
  type_action?: string;
  utilisateur?: string;
  date_debut?: string;
  date_fin?: string;
}

// ─── Action ─────────────────────────────────────────────

export async function getEntrepriseHistorique(
  entrepriseId: string,
  filters: HistoriqueFilters = {},
  page: number = 1,
) {
  const result = await getOrganisationId();
  if ("error" in result) {
    return { data: [], count: 0, error: result.error };
  }
  const { organisationId, admin } = result;

  // Verify enterprise belongs to org
  const { data: ent } = await admin
    .from("entreprises")
    .select("id")
    .eq("id", entrepriseId)
    .eq("organisation_id", organisationId)
    .single();

  if (!ent) {
    return { data: [], count: 0, error: "Entreprise non trouvée" };
  }

  // Fetch all data sources in parallel
  const [
    activitesResult,
    sessionsResult,
    inscriptionsResult,
    apprenantsResult,
    contactsResult,
    membresResult,
    agencesResult,
    polesResult,
    tachesResult,
  ] = await Promise.all([
    // 1. Activités (notes manuelles rattachées à l'entreprise)
    admin
      .from("activites")
      .select("id, contenu, created_at, utilisateurs:auteur_id(prenom, nom)")
      .eq("organisation_id", organisationId)
      .eq("entite_type", "entreprise")
      .eq("entite_id", entrepriseId)
      .order("created_at", { ascending: false }),

    // 2. Sessions (via session_commanditaires)
    admin
      .from("session_commanditaires")
      .select(`
        id, created_at, budget, statut_workflow, convention_signee,
        sessions(id, numero_affichage, nom, statut, date_debut, date_fin, created_at, updated_at)
      `)
      .eq("entreprise_id", entrepriseId),

    // 3. Inscriptions (apprenants inscrits dans des sessions liées à l'entreprise)
    admin
      .from("inscriptions")
      .select(`
        id, statut, created_at,
        apprenants(id, numero_affichage, prenom, nom),
        sessions!inner(id, numero_affichage, nom),
        session_commanditaires!inner(entreprise_id)
      `)
      .eq("session_commanditaires.entreprise_id", entrepriseId),

    // 4. Apprenants liés (apprenant_entreprises)
    admin
      .from("apprenant_entreprises")
      .select(`
        id,
        apprenants(id, numero_affichage, prenom, nom, created_at)
      `)
      .eq("entreprise_id", entrepriseId),

    // 5. Contacts liés (contact_entreprises)
    admin
      .from("contact_entreprises")
      .select(`
        id,
        contacts_clients(id, numero_affichage, prenom, nom, created_at)
      `)
      .eq("entreprise_id", entrepriseId),

    // 6. Membres (entreprise_membres)
    admin
      .from("entreprise_membres")
      .select(`
        id, role, fonction, created_at,
        apprenants(id, prenom, nom),
        contacts_clients(id, prenom, nom),
        entreprise_agences(id, nom)
      `)
      .eq("entreprise_id", entrepriseId),

    // 7. Agences
    admin
      .from("entreprise_agences")
      .select("id, nom, est_siege, created_at")
      .eq("entreprise_id", entrepriseId),

    // 8. Pôles
    admin
      .from("entreprise_poles")
      .select("id, nom, created_at, entreprise_agences(nom)")
      .eq("entreprise_id", entrepriseId),

    // 9. Tâches (rattachées à l'entreprise)
    admin
      .from("taches")
      .select("id, titre, statut, priorite, completed_at, created_at, utilisateurs:assignee_id(prenom, nom)")
      .eq("organisation_id", organisationId)
      .eq("entite_type", "entreprise")
      .eq("entite_id", entrepriseId),
  ]);

  const events: HistoriqueEvent[] = [];

  // ── 1. Activités → events ──
  if (activitesResult.data) {
    for (const a of activitesResult.data) {
      const user = a.utilisateurs as unknown as { prenom: string; nom: string } | null;
      events.push({
        id: `activite-${a.id}`,
        date: a.created_at,
        module: "activite",
        type_action: "note_ajoutee",
        description: a.contenu,
        objet_label: null,
        objet_id: null,
        objet_href: null,
        utilisateur: user ? `${user.prenom} ${user.nom}` : null,
        origine: "backoffice",
        agence: null,
      });
    }
  }

  // ── 2. Sessions → events ──
  if (sessionsResult.data) {
    for (const sc of sessionsResult.data) {
      const session = sc.sessions as unknown as {
        id: string;
        numero_affichage: string;
        nom: string;
        statut: string;
        date_debut: string | null;
        date_fin: string | null;
        created_at: string;
        updated_at: string;
      } | null;
      if (!session) continue;

      // Session creation event
      events.push({
        id: `session-create-${sc.id}`,
        date: session.created_at,
        module: "session",
        type_action: "session_creee",
        description: `Session "${session.nom}" (${session.numero_affichage}) créée`,
        objet_label: `${session.numero_affichage} — ${session.nom}`,
        objet_id: session.id,
        objet_href: `/sessions/${session.id}`,
        utilisateur: null,
        origine: "backoffice",
        agence: null,
      });

      // Session status
      const statutLabels: Record<string, string> = {
        en_projet: "En projet",
        validee: "Validée",
        en_cours: "En cours",
        terminee: "Terminée",
        annulee: "Annulée",
      };
      if (session.statut !== "en_projet") {
        events.push({
          id: `session-statut-${sc.id}`,
          date: session.updated_at,
          module: "session",
          type_action: "session_statut_change",
          description: `Session "${session.nom}" passée au statut "${statutLabels[session.statut] || session.statut}"`,
          objet_label: `${session.numero_affichage} — ${session.nom}`,
          objet_id: session.id,
          objet_href: `/sessions/${session.id}`,
          utilisateur: null,
          origine: "backoffice",
          agence: null,
        });
      }

      // Commanditaire workflow
      if (sc.convention_signee) {
        events.push({
          id: `commanditaire-convention-${sc.id}`,
          date: sc.created_at,
          module: "session",
          type_action: "convention_signee",
          description: `Convention signée pour la session "${session.nom}"`,
          objet_label: `${session.numero_affichage} — ${session.nom}`,
          objet_id: session.id,
          objet_href: `/sessions/${session.id}`,
          utilisateur: null,
          origine: "backoffice",
          agence: null,
        });
      }
    }
  }

  // ── 3. Inscriptions → events ──
  if (inscriptionsResult.data) {
    for (const insc of inscriptionsResult.data) {
      const apprenant = insc.apprenants as unknown as {
        id: string;
        numero_affichage: string;
        prenom: string;
        nom: string;
      } | null;
      const session = insc.sessions as unknown as {
        id: string;
        numero_affichage: string;
        nom: string;
      } | null;
      if (!apprenant || !session) continue;

      const statutLabels: Record<string, string> = {
        inscrit: "inscrit",
        confirme: "confirmé",
        annule: "annulé",
        liste_attente: "en liste d'attente",
      };

      events.push({
        id: `inscription-${insc.id}`,
        date: insc.created_at,
        module: "inscription",
        type_action: `inscription_${insc.statut}`,
        description: `${apprenant.prenom} ${apprenant.nom} (${apprenant.numero_affichage}) ${statutLabels[insc.statut] || insc.statut} à la session "${session.nom}"`,
        objet_label: `${session.numero_affichage} — ${session.nom}`,
        objet_id: session.id,
        objet_href: `/sessions/${session.id}`,
        utilisateur: null,
        origine: "backoffice",
        agence: null,
      });
    }
  }

  // ── 4. Apprenants liés → events ──
  if (apprenantsResult.data) {
    for (const ae of apprenantsResult.data) {
      const app = ae.apprenants as unknown as {
        id: string;
        numero_affichage: string;
        prenom: string;
        nom: string;
        created_at: string;
      } | null;
      if (!app) continue;

      events.push({
        id: `apprenant-link-${ae.id}`,
        date: app.created_at,
        module: "apprenant",
        type_action: "apprenant_rattache",
        description: `${app.prenom} ${app.nom} (${app.numero_affichage}) rattaché à l'entreprise`,
        objet_label: `${app.numero_affichage} — ${app.prenom} ${app.nom}`,
        objet_id: app.id,
        objet_href: `/apprenants/${app.id}`,
        utilisateur: null,
        origine: "backoffice",
        agence: null,
      });
    }
  }

  // ── 5. Contacts liés → events ──
  if (contactsResult.data) {
    for (const ce of contactsResult.data) {
      const contact = ce.contacts_clients as unknown as {
        id: string;
        numero_affichage: string;
        prenom: string;
        nom: string;
        created_at: string;
      } | null;
      if (!contact) continue;

      events.push({
        id: `contact-link-${ce.id}`,
        date: contact.created_at,
        module: "contact",
        type_action: "contact_rattache",
        description: `${contact.prenom} ${contact.nom} (${contact.numero_affichage}) rattaché comme contact`,
        objet_label: `${contact.numero_affichage} — ${contact.prenom} ${contact.nom}`,
        objet_id: contact.id,
        objet_href: `/contacts-clients/${contact.id}`,
        utilisateur: null,
        origine: "backoffice",
        agence: null,
      });
    }
  }

  // ── 6. Membres → events ──
  if (membresResult.data) {
    for (const m of membresResult.data) {
      const app = m.apprenants as unknown as { id: string; prenom: string; nom: string } | null;
      const contact = m.contacts_clients as unknown as { id: string; prenom: string; nom: string } | null;
      const agence = m.entreprise_agences as unknown as { id: string; nom: string } | null;
      const personName = app
        ? `${app.prenom} ${app.nom}`
        : contact
          ? `${contact.prenom} ${contact.nom}`
          : "Inconnu";

      const roleLabels: Record<string, string> = {
        direction: "Direction",
        responsable_formation: "Responsable formation",
        manager: "Manager",
        employe: "Employé",
      };

      events.push({
        id: `membre-${m.id}`,
        date: m.created_at,
        module: "organisation",
        type_action: "membre_ajoute",
        description: `${personName} ajouté comme ${roleLabels[m.role] || m.role}${agence ? ` (${agence.nom})` : ""}`,
        objet_label: personName,
        objet_id: app?.id || contact?.id || null,
        objet_href: app ? `/apprenants/${app.id}` : contact ? `/contacts-clients/${contact.id}` : null,
        utilisateur: null,
        origine: "backoffice",
        agence: agence?.nom || null,
      });
    }
  }

  // ── 7. Agences → events ──
  if (agencesResult.data) {
    for (const ag of agencesResult.data) {
      events.push({
        id: `agence-${ag.id}`,
        date: ag.created_at,
        module: "organisation",
        type_action: "agence_creee",
        description: `Agence "${ag.nom}" créée${ag.est_siege ? " (siège social)" : ""}`,
        objet_label: ag.nom,
        objet_id: ag.id,
        objet_href: null,
        utilisateur: null,
        origine: "backoffice",
        agence: ag.nom,
      });
    }
  }

  // ── 8. Pôles → events ──
  if (polesResult.data) {
    for (const p of polesResult.data) {
      const agence = p.entreprise_agences as unknown as { nom: string } | null;
      events.push({
        id: `pole-${p.id}`,
        date: p.created_at,
        module: "organisation",
        type_action: "pole_cree",
        description: `Pôle "${p.nom}" créé${agence ? ` (${agence.nom})` : ""}`,
        objet_label: p.nom,
        objet_id: p.id,
        objet_href: null,
        utilisateur: null,
        origine: "backoffice",
        agence: agence?.nom || null,
      });
    }
  }

  // ── 9. Tâches → events ──
  if (tachesResult.data) {
    for (const t of tachesResult.data) {
      const user = t.utilisateurs as unknown as { prenom: string; nom: string } | null;

      // Task creation
      events.push({
        id: `tache-${t.id}`,
        date: t.created_at,
        module: "tache",
        type_action: "tache_creee",
        description: `Tâche "${t.titre}" créée`,
        objet_label: t.titre,
        objet_id: t.id,
        objet_href: null,
        utilisateur: user ? `${user.prenom} ${user.nom}` : null,
        origine: "backoffice",
        agence: null,
      });

      // Task completion
      if (t.completed_at) {
        events.push({
          id: `tache-done-${t.id}`,
          date: t.completed_at,
          module: "tache",
          type_action: "tache_terminee",
          description: `Tâche "${t.titre}" terminée`,
          objet_label: t.titre,
          objet_id: t.id,
          objet_href: null,
          utilisateur: user ? `${user.prenom} ${user.nom}` : null,
          origine: "backoffice",
          agence: null,
        });
      }
    }
  }

  // ── Apply filters ──
  let filtered = events;

  if (filters.module) {
    filtered = filtered.filter((e) => e.module === filters.module);
  }
  if (filters.type_action) {
    filtered = filtered.filter((e) => e.type_action === filters.type_action);
  }
  if (filters.utilisateur) {
    filtered = filtered.filter(
      (e) => e.utilisateur && e.utilisateur.toLowerCase().includes(filters.utilisateur!.toLowerCase()),
    );
  }
  if (filters.date_debut) {
    const debut = new Date(filters.date_debut);
    filtered = filtered.filter((e) => new Date(e.date) >= debut);
  }
  if (filters.date_fin) {
    const fin = new Date(filters.date_fin);
    fin.setHours(23, 59, 59, 999);
    filtered = filtered.filter((e) => new Date(e.date) <= fin);
  }

  // ── Sort by date descending ──
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Paginate ──
  const limit = 25;
  const offset = (page - 1) * limit;
  const paginated = filtered.slice(offset, offset + limit);

  return { data: paginated, count: filtered.length };
}
