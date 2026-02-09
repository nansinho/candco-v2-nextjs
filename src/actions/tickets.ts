"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/auth-helpers";
import { getExtranetUserContext } from "@/actions/extranet-context";
import { logHistorique } from "@/lib/historique";
import { sendEmail } from "@/lib/emails/send-email";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Schemas ─────────────────────────────────────────────

const CreateTicketSchema = z.object({
  titre: z.string().min(1, "Le titre est requis"),
  description: z.string().optional().or(z.literal("")),
  priorite: z.enum(["basse", "normale", "haute", "urgente"]).default("normale"),
  categorie: z.enum(["bug", "demande", "question", "amelioration", "autre"]).optional().nullable(),
  entreprise_id: z.string().uuid().optional().nullable().or(z.literal("")),
  assignee_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

const UpdateTicketSchema = z.object({
  statut: z.enum(["ouvert", "en_cours", "en_attente", "resolu", "ferme"]).optional(),
  priorite: z.enum(["basse", "normale", "haute", "urgente"]).optional(),
  categorie: z.enum(["bug", "demande", "question", "amelioration", "autre"]).optional().nullable(),
  entreprise_id: z.string().uuid().optional().nullable().or(z.literal("")),
  assignee_id: z.string().uuid().optional().nullable().or(z.literal("")),
});

export type UpdateTicketInput = z.infer<typeof UpdateTicketSchema>;

// ─── Types ───────────────────────────────────────────────

export interface TicketRow {
  id: string;
  numero_affichage: string;
  titre: string;
  description: string | null;
  statut: string;
  priorite: string;
  categorie: string | null;
  auteur_nom: string | null;
  auteur_type: string;
  auteur_email: string | null;
  auteur_user_id: string | null;
  assignee_id: string | null;
  assignee?: { prenom: string; nom: string } | null;
  entreprise?: { id: string; nom: string } | null;
  entreprise_id: string | null;
  message_count: number;
  last_message_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  auteur_user_id: string | null;
  auteur_type: string;
  auteur_nom: string | null;
  contenu: string;
  is_internal: boolean;
  fichiers: { nom: string; url: string; taille: number; mime_type: string }[];
  created_at: string;
}

export interface TicketHistoriqueEntry {
  id: string;
  ticket_id: string;
  auteur_user_id: string | null;
  auteur_nom: string | null;
  action: string;
  ancien_valeur: string | null;
  nouveau_valeur: string | null;
  created_at: string;
}

export interface TicketDetail {
  ticket: TicketRow;
  messages: TicketMessage[];
  historique: TicketHistoriqueEntry[];
}

export interface TicketFilters {
  statut?: string;
  priorite?: string;
  categorie?: string;
  entreprise_id?: string;
  assignee_id?: string;
  my_tickets?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

async function getNextTicketNumero(admin: ReturnType<typeof createAdminClient>, organisationId: string): Promise<string> {
  const { data } = await admin.rpc("increment_sequence", {
    p_organisation_id: organisationId,
    p_entite: "TIC",
  });

  if (data) {
    return `TIC-${String(data).padStart(4, "0")}`;
  }

  // Fallback: manual increment
  const { data: seq } = await admin
    .from("sequences")
    .select("compteur")
    .eq("organisation_id", organisationId)
    .eq("entite", "TIC")
    .single();

  const newCount = (seq?.compteur ?? 0) + 1;

  await admin
    .from("sequences")
    .upsert({
      organisation_id: organisationId,
      entite: "TIC",
      compteur: newCount,
    }, { onConflict: "organisation_id,entite" });

  return `TIC-${String(newCount).padStart(4, "0")}`;
}

const STATUT_LABELS: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  en_attente: "En attente",
  resolu: "Résolu",
  ferme: "Fermé",
};

const PRIORITE_LABELS: Record<string, string> = {
  basse: "Basse",
  normale: "Normale",
  haute: "Haute",
  urgente: "Urgente",
};

const CATEGORIE_LABELS: Record<string, string> = {
  bug: "Bug",
  demande: "Demande",
  question: "Question",
  amelioration: "Amélioration",
  autre: "Autre",
};

// ─── Back-office CRUD ────────────────────────────────────

export async function getTickets(
  page: number = 1,
  search: string = "",
  sortBy: string = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: TicketFilters = {},
) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], count: 0, error: result.error };
  const { organisationId, userId, admin } = result;

  const limit = 25;
  const offset = (page - 1) * limit;

  const allowedSort = ["numero_affichage", "titre", "statut", "priorite", "categorie", "created_at", "updated_at"];
  const col = allowedSort.includes(sortBy) ? sortBy : "created_at";

  let query = admin
    .from("tickets")
    .select(
      `*, entreprises(id, nom), utilisateurs!tickets_assignee_id_fkey(prenom, nom)`,
      { count: "exact" },
    )
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order(col, { ascending: sortDir === "asc" })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`titre.ilike.%${search}%,numero_affichage.ilike.%${search}%,auteur_nom.ilike.%${search}%`);
  }

  if (filters.statut) {
    query = query.eq("statut", filters.statut);
  }
  if (filters.priorite) {
    query = query.eq("priorite", filters.priorite);
  }
  if (filters.categorie) {
    query = query.eq("categorie", filters.categorie);
  }
  if (filters.entreprise_id) {
    query = query.eq("entreprise_id", filters.entreprise_id);
  }
  if (filters.assignee_id) {
    query = query.eq("assignee_id", filters.assignee_id);
  }
  if (filters.my_tickets) {
    query = query.eq("assignee_id", userId);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("[getTickets]", error);
    return { data: [], count: 0, error: error.message };
  }

  // Get message counts for each ticket
  const ticketIds = (data || []).map((t: Record<string, unknown>) => t.id as string);
  let messageCounts: Record<string, { count: number; last: string | null }> = {};

  if (ticketIds.length > 0) {
    const { data: messages } = await admin
      .from("ticket_messages")
      .select("ticket_id, created_at")
      .in("ticket_id", ticketIds)
      .order("created_at", { ascending: false });

    if (messages) {
      for (const msg of messages) {
        const tid = msg.ticket_id as string;
        if (!messageCounts[tid]) {
          messageCounts[tid] = { count: 0, last: msg.created_at as string };
        }
        messageCounts[tid].count++;
      }
    }
  }

  const rows: TicketRow[] = (data || []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    numero_affichage: (t.numero_affichage as string) || "",
    titre: t.titre as string,
    description: t.description as string | null,
    statut: t.statut as string,
    priorite: t.priorite as string,
    categorie: t.categorie as string | null,
    auteur_nom: t.auteur_nom as string | null,
    auteur_type: t.auteur_type as string,
    auteur_email: t.auteur_email as string | null,
    auteur_user_id: t.auteur_user_id as string | null,
    assignee_id: t.assignee_id as string | null,
    assignee: t.utilisateurs as { prenom: string; nom: string } | null,
    entreprise: t.entreprises as { id: string; nom: string } | null,
    entreprise_id: t.entreprise_id as string | null,
    message_count: messageCounts[t.id as string]?.count ?? 0,
    last_message_at: messageCounts[t.id as string]?.last ?? null,
    resolved_at: t.resolved_at as string | null,
    closed_at: t.closed_at as string | null,
    created_at: t.created_at as string,
    updated_at: t.updated_at as string,
  }));

  return { data: rows, count: count || 0, error: null };
}

export async function getTicket(ticketId: string): Promise<{ data?: TicketDetail; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  // Fetch ticket
  const { data: ticket, error } = await admin
    .from("tickets")
    .select(`*, entreprises(id, nom), utilisateurs!tickets_assignee_id_fkey(prenom, nom)`)
    .eq("id", ticketId)
    .eq("organisation_id", organisationId)
    .single();

  if (error || !ticket) {
    return { error: "Ticket non trouvé" };
  }

  // Fetch messages
  const { data: messages } = await admin
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  // Fetch historique
  const { data: historique } = await admin
    .from("ticket_historique")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  const ticketRow: TicketRow = {
    id: ticket.id,
    numero_affichage: ticket.numero_affichage || "",
    titre: ticket.titre,
    description: ticket.description,
    statut: ticket.statut,
    priorite: ticket.priorite,
    categorie: ticket.categorie,
    auteur_nom: ticket.auteur_nom,
    auteur_type: ticket.auteur_type,
    auteur_email: ticket.auteur_email,
    auteur_user_id: ticket.auteur_user_id,
    assignee_id: ticket.assignee_id,
    assignee: ticket.utilisateurs as { prenom: string; nom: string } | null,
    entreprise: ticket.entreprises as { id: string; nom: string } | null,
    entreprise_id: ticket.entreprise_id,
    message_count: (messages || []).length,
    last_message_at: messages && messages.length > 0 ? messages[messages.length - 1].created_at : null,
    resolved_at: ticket.resolved_at,
    closed_at: ticket.closed_at,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };

  return {
    data: {
      ticket: ticketRow,
      messages: (messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        ticket_id: m.ticket_id as string,
        auteur_user_id: m.auteur_user_id as string | null,
        auteur_type: m.auteur_type as string,
        auteur_nom: m.auteur_nom as string | null,
        contenu: m.contenu as string,
        is_internal: m.is_internal as boolean,
        fichiers: (m.fichiers as TicketMessage["fichiers"]) || [],
        created_at: m.created_at as string,
      })),
      historique: (historique || []) as TicketHistoriqueEntry[],
    },
  };
}

export async function createTicket(input: CreateTicketInput): Promise<{ data?: { id: string }; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  const parsed = CreateTicketSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Get user info
  const { data: user } = await admin
    .from("utilisateurs")
    .select("prenom, nom, email")
    .eq("id", userId)
    .single();

  const auteurNom = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "Utilisateur";

  // Generate numero
  const numero = await getNextTicketNumero(admin, organisationId);

  const insertData: Record<string, unknown> = {
    organisation_id: organisationId,
    numero_affichage: numero,
    titre: parsed.data.titre,
    description: parsed.data.description || null,
    priorite: parsed.data.priorite,
    categorie: parsed.data.categorie || null,
    entreprise_id: parsed.data.entreprise_id || null,
    assignee_id: parsed.data.assignee_id || null,
    auteur_user_id: userId,
    auteur_type: role,
    auteur_nom: auteurNom,
    auteur_email: user?.email || null,
  };

  const { data: ticket, error } = await admin
    .from("tickets")
    .insert(insertData)
    .select("id, numero_affichage")
    .single();

  if (error || !ticket) {
    console.error("[createTicket]", error);
    return { error: "Erreur lors de la création du ticket" };
  }

  // Log historique
  await admin.from("ticket_historique").insert({
    ticket_id: ticket.id,
    auteur_user_id: userId,
    auteur_nom: auteurNom,
    action: "created",
    nouveau_valeur: parsed.data.titre,
  });

  // Log global historique
  await logHistorique({
    organisationId,
    userId,
    userNom: auteurNom,
    userRole: role,
    module: "ticket",
    action: "created",
    entiteType: "ticket",
    entiteId: ticket.id,
    entiteLabel: `${ticket.numero_affichage} — ${parsed.data.titre}`,
    description: `Ticket "${parsed.data.titre}" créé`,
    objetHref: `/tickets/${ticket.id}`,
  });

  // Notify assignee if assigned
  if (parsed.data.assignee_id) {
    const { data: assignee } = await admin
      .from("utilisateurs")
      .select("email, prenom, nom")
      .eq("id", parsed.data.assignee_id)
      .single();

    if (assignee?.email) {
      await sendEmail({
        organisationId,
        to: assignee.email,
        toName: `${assignee.prenom || ""} ${assignee.nom || ""}`.trim(),
        subject: `[${numero}] Ticket assigné : ${parsed.data.titre}`,
        html: `<p>Un nouveau ticket vous a été assigné :</p>
<p><strong>${parsed.data.titre}</strong></p>
${parsed.data.description ? `<p>${parsed.data.description.substring(0, 500)}</p>` : ""}
<p>Par : ${auteurNom}</p>`,
        entiteType: "ticket",
        entiteId: ticket.id,
        template: "ticket_assigned",
      });
    }
  }

  revalidatePath("/tickets");
  return { data: { id: ticket.id } };
}

export async function updateTicket(
  ticketId: string,
  input: UpdateTicketInput,
): Promise<{ error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  const parsed = UpdateTicketSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Get current ticket
  const { data: current } = await admin
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("organisation_id", organisationId)
    .single();

  if (!current) return { error: "Ticket non trouvé" };

  // Get user info
  const { data: user } = await admin
    .from("utilisateurs")
    .select("prenom, nom")
    .eq("id", userId)
    .single();
  const auteurNom = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "Utilisateur";

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const historiqueEntries: {
    ticket_id: string;
    auteur_user_id: string;
    auteur_nom: string;
    action: string;
    ancien_valeur: string | null;
    nouveau_valeur: string | null;
  }[] = [];

  // Track each field change
  if (parsed.data.statut && parsed.data.statut !== current.statut) {
    updateData.statut = parsed.data.statut;
    if (parsed.data.statut === "resolu") updateData.resolved_at = new Date().toISOString();
    if (parsed.data.statut === "ferme") updateData.closed_at = new Date().toISOString();
    if (parsed.data.statut === "ouvert" && (current.statut === "resolu" || current.statut === "ferme")) {
      updateData.resolved_at = null;
      updateData.closed_at = null;
    }

    historiqueEntries.push({
      ticket_id: ticketId,
      auteur_user_id: userId,
      auteur_nom: auteurNom,
      action: "status_changed",
      ancien_valeur: STATUT_LABELS[current.statut] || current.statut,
      nouveau_valeur: STATUT_LABELS[parsed.data.statut] || parsed.data.statut,
    });
  }

  if (parsed.data.priorite && parsed.data.priorite !== current.priorite) {
    updateData.priorite = parsed.data.priorite;
    historiqueEntries.push({
      ticket_id: ticketId,
      auteur_user_id: userId,
      auteur_nom: auteurNom,
      action: "priority_changed",
      ancien_valeur: PRIORITE_LABELS[current.priorite] || current.priorite,
      nouveau_valeur: PRIORITE_LABELS[parsed.data.priorite] || parsed.data.priorite,
    });
  }

  if (parsed.data.categorie !== undefined && parsed.data.categorie !== current.categorie) {
    updateData.categorie = parsed.data.categorie || null;
    historiqueEntries.push({
      ticket_id: ticketId,
      auteur_user_id: userId,
      auteur_nom: auteurNom,
      action: "category_changed",
      ancien_valeur: current.categorie ? (CATEGORIE_LABELS[current.categorie] || current.categorie) : null,
      nouveau_valeur: parsed.data.categorie ? (CATEGORIE_LABELS[parsed.data.categorie] || parsed.data.categorie) : null,
    });
  }

  if (parsed.data.entreprise_id !== undefined) {
    const newEntId = parsed.data.entreprise_id || null;
    if (newEntId !== current.entreprise_id) {
      updateData.entreprise_id = newEntId;
      // Get enterprise names
      let oldName: string | null = null;
      let newName: string | null = null;
      if (current.entreprise_id) {
        const { data: ent } = await admin.from("entreprises").select("nom").eq("id", current.entreprise_id).single();
        oldName = ent?.nom || null;
      }
      if (newEntId) {
        const { data: ent } = await admin.from("entreprises").select("nom").eq("id", newEntId).single();
        newName = ent?.nom || null;
      }
      historiqueEntries.push({
        ticket_id: ticketId,
        auteur_user_id: userId,
        auteur_nom: auteurNom,
        action: "entreprise_changed",
        ancien_valeur: oldName,
        nouveau_valeur: newName,
      });
    }
  }

  if (parsed.data.assignee_id !== undefined) {
    const newAssigneeId = parsed.data.assignee_id || null;
    if (newAssigneeId !== current.assignee_id) {
      updateData.assignee_id = newAssigneeId;

      if (newAssigneeId) {
        const { data: assignee } = await admin.from("utilisateurs").select("prenom, nom, email").eq("id", newAssigneeId).single();
        const assigneeName = assignee ? `${assignee.prenom || ""} ${assignee.nom || ""}`.trim() : "Inconnu";
        historiqueEntries.push({
          ticket_id: ticketId,
          auteur_user_id: userId,
          auteur_nom: auteurNom,
          action: "assigned",
          ancien_valeur: null,
          nouveau_valeur: assigneeName,
        });

        // Email notification to assignee
        if (assignee?.email) {
          await sendEmail({
            organisationId,
            to: assignee.email,
            toName: assigneeName,
            subject: `[${current.numero_affichage}] Ticket assigné : ${current.titre}`,
            html: `<p>Le ticket <strong>${current.titre}</strong> vous a été assigné par ${auteurNom}.</p>`,
            entiteType: "ticket",
            entiteId: ticketId,
            template: "ticket_assigned",
          });
        }
      } else {
        historiqueEntries.push({
          ticket_id: ticketId,
          auteur_user_id: userId,
          auteur_nom: auteurNom,
          action: "unassigned",
          ancien_valeur: null,
          nouveau_valeur: null,
        });
      }
    }
  }

  // Apply update
  const { error } = await admin
    .from("tickets")
    .update(updateData)
    .eq("id", ticketId)
    .eq("organisation_id", organisationId);

  if (error) {
    console.error("[updateTicket]", error);
    return { error: "Erreur lors de la mise à jour" };
  }

  // Insert historique entries
  if (historiqueEntries.length > 0) {
    await admin.from("ticket_historique").insert(historiqueEntries);
  }

  // Email notification to ticket author on status change
  if (parsed.data.statut && parsed.data.statut !== current.statut && current.auteur_email) {
    await sendEmail({
      organisationId,
      to: current.auteur_email,
      toName: current.auteur_nom || undefined,
      subject: `[${current.numero_affichage}] Statut mis à jour : ${STATUT_LABELS[parsed.data.statut] || parsed.data.statut}`,
      html: `<p>Le statut de votre ticket <strong>${current.titre}</strong> a été mis à jour :</p>
<p>${STATUT_LABELS[current.statut] || current.statut} → <strong>${STATUT_LABELS[parsed.data.statut] || parsed.data.statut}</strong></p>
<p>Par : ${auteurNom}</p>`,
      entiteType: "ticket",
      entiteId: ticketId,
      template: "ticket_status_changed",
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  return {};
}

export async function archiveTickets(ids: string[]): Promise<{ error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, admin } = result;

  const { error } = await admin
    .from("tickets")
    .update({ archived_at: new Date().toISOString() })
    .eq("organisation_id", organisationId)
    .in("id", ids);

  if (error) return { error: error.message };

  revalidatePath("/tickets");
  return {};
}

// ─── Messages ────────────────────────────────────────────

export async function addTicketMessage(
  ticketId: string,
  contenu: string,
  fichiers: { nom: string; url: string; taille: number; mime_type: string }[] = [],
  isInternal: boolean = false,
  mentionedUserIds: string[] = [],
): Promise<{ data?: { id: string }; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, userId, role, admin } = result;

  if (!contenu.trim()) return { error: "Le message ne peut pas être vide" };

  // Verify ticket exists and belongs to org
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titre, numero_affichage, auteur_email, auteur_nom, auteur_user_id, organisation_id")
    .eq("id", ticketId)
    .eq("organisation_id", organisationId)
    .single();

  if (!ticket) return { error: "Ticket non trouvé" };

  // Get user info
  const { data: user } = await admin
    .from("utilisateurs")
    .select("prenom, nom, email")
    .eq("id", userId)
    .single();
  const auteurNom = user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "Utilisateur";

  // Insert message
  const { data: message, error } = await admin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      auteur_user_id: userId,
      auteur_type: role,
      auteur_nom: auteurNom,
      contenu,
      is_internal: isInternal,
      fichiers,
    })
    .select("id")
    .single();

  if (error || !message) {
    console.error("[addTicketMessage]", error);
    return { error: "Erreur lors de l'envoi du message" };
  }

  // Update ticket updated_at
  await admin
    .from("tickets")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  // Log historique entry
  await admin.from("ticket_historique").insert({
    ticket_id: ticketId,
    auteur_user_id: userId,
    auteur_nom: auteurNom,
    action: "replied",
    nouveau_valeur: isInternal ? "Note interne" : "Réponse",
  });

  // Handle mentions
  if (mentionedUserIds.length > 0) {
    const mentionInserts = mentionedUserIds.map((uid) => ({
      message_id: message.id,
      ticket_id: ticketId,
      mentioned_user_id: uid,
      notified: false,
    }));
    await admin.from("ticket_mentions").insert(mentionInserts);

    // Send email to each mentioned user
    for (const mentionedId of mentionedUserIds) {
      // Check utilisateurs table first
      const { data: mentionedUser } = await admin
        .from("utilisateurs")
        .select("email, prenom, nom")
        .eq("id", mentionedId)
        .single();

      const email = mentionedUser?.email;
      const name = mentionedUser ? `${mentionedUser.prenom || ""} ${mentionedUser.nom || ""}`.trim() : null;

      if (email) {
        await sendEmail({
          organisationId,
          to: email,
          toName: name || undefined,
          subject: `[${ticket.numero_affichage}] Vous avez été mentionné dans : ${ticket.titre}`,
          html: `<p><strong>${auteurNom}</strong> vous a mentionné dans le ticket <strong>${ticket.titre}</strong> :</p>
<blockquote>${contenu.substring(0, 500)}</blockquote>`,
          entiteType: "ticket",
          entiteId: ticketId,
          template: "ticket_mention",
        });

        await admin
          .from("ticket_mentions")
          .update({ notified: true })
          .eq("message_id", message.id)
          .eq("mentioned_user_id", mentionedId);
      }
    }
  }

  // Send email notification to ticket author if someone else replied (and not internal)
  if (!isInternal && ticket.auteur_user_id !== userId && ticket.auteur_email) {
    await sendEmail({
      organisationId,
      to: ticket.auteur_email,
      toName: ticket.auteur_nom || undefined,
      subject: `[${ticket.numero_affichage}] Nouvelle réponse : ${ticket.titre}`,
      html: `<p><strong>${auteurNom}</strong> a répondu à votre ticket <strong>${ticket.titre}</strong> :</p>
<blockquote>${contenu.substring(0, 500)}</blockquote>`,
      entiteType: "ticket",
      entiteId: ticketId,
      template: "ticket_reply",
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  return { data: { id: message.id } };
}

// ─── Mentionable users search ────────────────────────────

export async function searchMentionableUsers(query: string): Promise<{ data: { id: string; nom: string; type: string }[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  const users: { id: string; nom: string; type: string }[] = [];

  // Search back-office users
  const { data: boUsers } = await admin
    .from("utilisateurs")
    .select("id, prenom, nom, role")
    .eq("organisation_id", organisationId)
    .eq("actif", true)
    .or(`prenom.ilike.%${query}%,nom.ilike.%${query}%`)
    .limit(10);

  if (boUsers) {
    for (const u of boUsers) {
      users.push({
        id: u.id,
        nom: `${u.prenom || ""} ${u.nom || ""}`.trim(),
        type: u.role as string,
      });
    }
  }

  // Search extranet users (formateurs, apprenants, contacts)
  const { data: extranetAcces } = await admin
    .from("extranet_acces")
    .select("user_id, role, entite_type, entite_id")
    .eq("organisation_id", organisationId)
    .eq("statut", "actif")
    .limit(50);

  if (extranetAcces) {
    for (const acces of extranetAcces) {
      const tableMap: Record<string, string> = {
        formateur: "formateurs",
        apprenant: "apprenants",
        contact_client: "contacts_clients",
      };
      const table = tableMap[acces.role as string];
      if (!table) continue;

      const { data: entity } = await admin
        .from(table)
        .select("prenom, nom")
        .eq("id", acces.entite_id)
        .single();

      if (entity) {
        const fullName = `${(entity as { prenom: string }).prenom || ""} ${(entity as { nom: string }).nom || ""}`.trim();
        if (fullName.toLowerCase().includes(query.toLowerCase())) {
          users.push({
            id: acces.user_id as string,
            nom: fullName,
            type: acces.role as string,
          });
        }
      }
    }
  }

  return { data: users.slice(0, 15) };
}

// ─── Extranet tickets ────────────────────────────────────

export async function createExtranetTicket(input: {
  titre: string;
  description?: string;
  categorie?: string;
  fichiers?: { nom: string; url: string; taille: number; mime_type: string }[];
}): Promise<{ data?: { id: string }; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: ctx.error || "Non authentifié" };

  const admin = createAdminClient();
  const { userId, prenom, nom, email, role, organisationId } = ctx.data;

  if (!input.titre?.trim()) return { error: "Le titre est requis" };

  const auteurNom = `${prenom} ${nom}`.trim();
  const numero = await getNextTicketNumero(admin, organisationId);

  const { data: ticket, error } = await admin
    .from("tickets")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      titre: input.titre,
      description: input.description || null,
      categorie: input.categorie || null,
      priorite: "normale",
      auteur_user_id: userId,
      auteur_type: role,
      auteur_nom: auteurNom,
      auteur_email: email,
    })
    .select("id, numero_affichage")
    .single();

  if (error || !ticket) {
    console.error("[createExtranetTicket]", error);
    return { error: "Erreur lors de la création du ticket" };
  }

  // Add initial message with description + fichiers if any
  if (input.description || (input.fichiers && input.fichiers.length > 0)) {
    await admin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      auteur_user_id: userId,
      auteur_type: role,
      auteur_nom: auteurNom,
      contenu: input.description || "Ticket créé",
      fichiers: input.fichiers || [],
    });
  }

  // Log historique
  await admin.from("ticket_historique").insert({
    ticket_id: ticket.id,
    auteur_user_id: userId,
    auteur_nom: auteurNom,
    action: "created",
    nouveau_valeur: input.titre,
  });

  await logHistorique({
    organisationId,
    userId,
    userNom: auteurNom,
    userRole: role,
    origine: "extranet",
    module: "ticket",
    action: "created",
    entiteType: "ticket",
    entiteId: ticket.id,
    entiteLabel: `${ticket.numero_affichage} — ${input.titre}`,
    description: `Ticket "${input.titre}" créé depuis l'extranet ${role}`,
    objetHref: `/tickets/${ticket.id}`,
  });

  // Notify admins of the OF
  const { data: admins } = await admin
    .from("utilisateurs")
    .select("email, prenom, nom")
    .eq("organisation_id", organisationId)
    .eq("role", "admin")
    .eq("actif", true);

  if (admins) {
    for (const adminUser of admins) {
      if (adminUser.email) {
        await sendEmail({
          organisationId,
          to: adminUser.email,
          toName: `${adminUser.prenom || ""} ${adminUser.nom || ""}`.trim(),
          subject: `[${numero}] Nouveau ticket : ${input.titre}`,
          html: `<p>Un nouveau ticket a été créé par <strong>${auteurNom}</strong> (${role}) :</p>
<p><strong>${input.titre}</strong></p>
${input.description ? `<p>${input.description.substring(0, 500)}</p>` : ""}`,
          entiteType: "ticket",
          entiteId: ticket.id,
          template: "ticket_new_extranet",
        });
      }
    }
  }

  return { data: { id: ticket.id } };
}

export async function getExtranetTickets(
  page: number = 1,
): Promise<{ data: TicketRow[]; count: number; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { data: [], count: 0, error: ctx.error };

  const admin = createAdminClient();
  const { userId } = ctx.data;

  const limit = 25;
  const offset = (page - 1) * limit;

  const { data, count, error } = await admin
    .from("tickets")
    .select("*", { count: "exact" })
    .eq("auteur_user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return { data: [], count: 0, error: error.message };

  // Get message counts
  const ticketIds = (data || []).map((t: Record<string, unknown>) => t.id as string);
  let messageCounts: Record<string, { count: number; last: string | null }> = {};

  if (ticketIds.length > 0) {
    const { data: messages } = await admin
      .from("ticket_messages")
      .select("ticket_id, created_at")
      .in("ticket_id", ticketIds)
      .eq("is_internal", false)
      .order("created_at", { ascending: false });

    if (messages) {
      for (const msg of messages) {
        const tid = msg.ticket_id as string;
        if (!messageCounts[tid]) {
          messageCounts[tid] = { count: 0, last: msg.created_at as string };
        }
        messageCounts[tid].count++;
      }
    }
  }

  const rows: TicketRow[] = (data || []).map((t: Record<string, unknown>) => ({
    id: t.id as string,
    numero_affichage: (t.numero_affichage as string) || "",
    titre: t.titre as string,
    description: t.description as string | null,
    statut: t.statut as string,
    priorite: t.priorite as string,
    categorie: t.categorie as string | null,
    auteur_nom: t.auteur_nom as string | null,
    auteur_type: t.auteur_type as string,
    auteur_email: t.auteur_email as string | null,
    auteur_user_id: t.auteur_user_id as string | null,
    assignee_id: t.assignee_id as string | null,
    assignee: null,
    entreprise: null,
    entreprise_id: t.entreprise_id as string | null,
    message_count: messageCounts[t.id as string]?.count ?? 0,
    last_message_at: messageCounts[t.id as string]?.last ?? null,
    resolved_at: t.resolved_at as string | null,
    closed_at: t.closed_at as string | null,
    created_at: t.created_at as string,
    updated_at: t.updated_at as string,
  }));

  return { data: rows, count: count || 0 };
}

export async function getExtranetTicket(ticketId: string): Promise<{ data?: TicketDetail; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: ctx.error || "Non authentifié" };

  const admin = createAdminClient();
  const { userId } = ctx.data;

  // Fetch ticket — must be authored by this user
  const { data: ticket, error } = await admin
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .eq("auteur_user_id", userId)
    .single();

  if (error || !ticket) return { error: "Ticket non trouvé" };

  // Fetch messages — exclude internal ones
  const { data: messages } = await admin
    .from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .eq("is_internal", false)
    .order("created_at", { ascending: true });

  // Fetch historique
  const { data: historique } = await admin
    .from("ticket_historique")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  const ticketRow: TicketRow = {
    id: ticket.id,
    numero_affichage: ticket.numero_affichage || "",
    titre: ticket.titre,
    description: ticket.description,
    statut: ticket.statut,
    priorite: ticket.priorite,
    categorie: ticket.categorie,
    auteur_nom: ticket.auteur_nom,
    auteur_type: ticket.auteur_type,
    auteur_email: ticket.auteur_email,
    auteur_user_id: ticket.auteur_user_id,
    assignee_id: ticket.assignee_id,
    assignee: null,
    entreprise: null,
    entreprise_id: ticket.entreprise_id,
    message_count: (messages || []).length,
    last_message_at: messages && messages.length > 0 ? messages[messages.length - 1].created_at : null,
    resolved_at: ticket.resolved_at,
    closed_at: ticket.closed_at,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at,
  };

  return {
    data: {
      ticket: ticketRow,
      messages: (messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        ticket_id: m.ticket_id as string,
        auteur_user_id: m.auteur_user_id as string | null,
        auteur_type: m.auteur_type as string,
        auteur_nom: m.auteur_nom as string | null,
        contenu: m.contenu as string,
        is_internal: false,
        fichiers: (m.fichiers as TicketMessage["fichiers"]) || [],
        created_at: m.created_at as string,
      })),
      historique: (historique || []) as TicketHistoriqueEntry[],
    },
  };
}

export async function addExtranetTicketMessage(
  ticketId: string,
  contenu: string,
  fichiers: { nom: string; url: string; taille: number; mime_type: string }[] = [],
): Promise<{ data?: { id: string }; error?: string }> {
  const ctx = await getExtranetUserContext();
  if (ctx.error || !ctx.data) return { error: ctx.error || "Non authentifié" };

  const admin = createAdminClient();
  const { userId, prenom, nom, role, organisationId } = ctx.data;

  if (!contenu.trim()) return { error: "Le message ne peut pas être vide" };

  // Verify ticket belongs to this user
  const { data: ticket } = await admin
    .from("tickets")
    .select("id, titre, numero_affichage, organisation_id, assignee_id")
    .eq("id", ticketId)
    .eq("auteur_user_id", userId)
    .single();

  if (!ticket) return { error: "Ticket non trouvé" };

  const auteurNom = `${prenom} ${nom}`.trim();

  const { data: message, error } = await admin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      auteur_user_id: userId,
      auteur_type: role,
      auteur_nom: auteurNom,
      contenu,
      is_internal: false,
      fichiers,
    })
    .select("id")
    .single();

  if (error || !message) return { error: "Erreur lors de l'envoi" };

  // Update ticket updated_at
  await admin.from("tickets").update({ updated_at: new Date().toISOString() }).eq("id", ticketId);

  // Log historique
  await admin.from("ticket_historique").insert({
    ticket_id: ticketId,
    auteur_user_id: userId,
    auteur_nom: auteurNom,
    action: "replied",
    nouveau_valeur: "Réponse extranet",
  });

  // Notify assignee or admins
  if (ticket.assignee_id) {
    const { data: assignee } = await admin
      .from("utilisateurs")
      .select("email, prenom, nom")
      .eq("id", ticket.assignee_id)
      .single();

    if (assignee?.email) {
      await sendEmail({
        organisationId,
        to: assignee.email,
        toName: `${assignee.prenom || ""} ${assignee.nom || ""}`.trim(),
        subject: `[${ticket.numero_affichage}] Nouvelle réponse : ${ticket.titre}`,
        html: `<p><strong>${auteurNom}</strong> a répondu au ticket <strong>${ticket.titre}</strong> :</p>
<blockquote>${contenu.substring(0, 500)}</blockquote>`,
        entiteType: "ticket",
        entiteId: ticketId,
        template: "ticket_reply_extranet",
      });
    }
  }

  return { data: { id: message.id } };
}

// ─── Dashboard stats ─────────────────────────────────────

export async function getTicketStats(): Promise<{
  ouverts: number;
  en_cours: number;
  en_attente: number;
  urgents: number;
  recents: { id: string; numero_affichage: string; titre: string; auteur_nom: string | null; auteur_type: string; created_at: string; statut: string; priorite: string }[];
}> {
  const result = await getOrganisationId();
  if ("error" in result) return { ouverts: 0, en_cours: 0, en_attente: 0, urgents: 0, recents: [] };
  const { organisationId, admin } = result;

  const [ouvertsRes, enCoursRes, enAttenteRes, urgentsRes, recentsRes] = await Promise.all([
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "ouvert").is("archived_at", null),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "en_cours").is("archived_at", null),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("statut", "en_attente").is("archived_at", null),
    admin.from("tickets").select("id", { count: "exact", head: true }).eq("organisation_id", organisationId).eq("priorite", "urgente").in("statut", ["ouvert", "en_cours", "en_attente"]).is("archived_at", null),
    admin.from("tickets").select("id, numero_affichage, titre, auteur_nom, auteur_type, created_at, statut, priorite").eq("organisation_id", organisationId).in("statut", ["ouvert", "en_cours", "en_attente"]).is("archived_at", null).order("created_at", { ascending: false }).limit(5),
  ]);

  return {
    ouverts: ouvertsRes.count || 0,
    en_cours: enCoursRes.count || 0,
    en_attente: enAttenteRes.count || 0,
    urgents: urgentsRes.count || 0,
    recents: (recentsRes.data || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      numero_affichage: t.numero_affichage as string,
      titre: t.titre as string,
      auteur_nom: t.auteur_nom as string | null,
      auteur_type: t.auteur_type as string,
      created_at: t.created_at as string,
      statut: t.statut as string,
      priorite: t.priorite as string,
    })),
  };
}

// ─── Helper: get org users for assignment dropdown ───────

export async function getOrganisationUsers(): Promise<{ data: { id: string; nom: string; role: string }[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("utilisateurs")
    .select("id, prenom, nom, role")
    .eq("organisation_id", organisationId)
    .eq("actif", true)
    .order("nom");

  return {
    data: (data || []).map((u: Record<string, unknown>) => ({
      id: u.id as string,
      nom: `${u.prenom || ""} ${u.nom || ""}`.trim(),
      role: u.role as string,
    })),
  };
}

// ─── Helper: get enterprises for filtering ───────────────

export async function getEntreprisesForFilter(): Promise<{ data: { id: string; nom: string }[] }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { organisationId, admin } = result;

  const { data } = await admin
    .from("entreprises")
    .select("id, nom")
    .eq("organisation_id", organisationId)
    .is("archived_at", null)
    .order("nom")
    .limit(200);

  return { data: (data || []) as { id: string; nom: string }[] };
}
