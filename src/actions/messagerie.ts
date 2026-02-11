"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────

export interface Conversation {
  id: string;
  organisation_id: string;
  type: "direct" | "session_group" | "support";
  session_id: string | null;
  titre: string | null;
  created_at: string;
  participants?: ConversationParticipant[];
  last_message?: Message | null;
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string | null;
  dernier_lu_at: string | null;
  created_at: string;
  // Joined fields
  user_name?: string;
  user_email?: string;
}

export interface Message {
  id: string;
  organisation_id: string;
  conversation_id: string;
  sender_id: string;
  contenu: string;
  fichier_url: string | null;
  fichier_nom: string | null;
  created_at: string;
  // Joined
  sender_name?: string;
  sender_role?: string;
}

// ─── Get conversations for current user ─────────────────

export async function getMyConversations() {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, userId, organisationId } = result;

  // Get conversations where user is a participant
  const { data: participations } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (!participations || participations.length === 0) return { data: [] };

  const conversationIds = participations.map((p) => p.conversation_id);

  const { data: conversations, error } = await admin
    .from("conversations")
    .select("*")
    .in("id", conversationIds)
    .eq("organisation_id", organisationId)
    .order("created_at", { ascending: false });

  if (error) return { data: [] };

  // Enrich with participants, last message, unread count
  const enriched = await Promise.all(
    (conversations || []).map(async (conv) => {
      // Get participants with user info
      const { data: parts } = await admin
        .from("conversation_participants")
        .select("*")
        .eq("conversation_id", conv.id);

      // Get user names for participants
      const participantsEnriched = await Promise.all(
        (parts || []).map(async (p) => {
          // Try utilisateurs first (admin/manager)
          const { data: user } = await admin
            .from("utilisateurs")
            .select("prenom, nom, email")
            .eq("id", p.user_id)
            .single();

          if (user) {
            return {
              ...p,
              user_name: `${user.prenom || ""} ${user.nom || ""}`.trim() || user.email,
              user_email: user.email,
            };
          }

          // Try extranet_acces to find the entity
          const { data: acces } = await admin
            .from("extranet_acces")
            .select("role, entite_type, entite_id")
            .eq("user_id", p.user_id)
            .eq("organisation_id", organisationId)
            .single();

          if (acces) {
            let name = p.user_id;
            if (acces.entite_type === "formateur") {
              const { data: f } = await admin.from("formateurs").select("prenom, nom").eq("id", acces.entite_id).single();
              if (f) name = `${f.prenom} ${f.nom}`;
            } else if (acces.entite_type === "apprenant") {
              const { data: a } = await admin.from("apprenants").select("prenom, nom").eq("id", acces.entite_id).single();
              if (a) name = `${a.prenom} ${a.nom}`;
            } else if (acces.entite_type === "contact_client") {
              const { data: c } = await admin.from("contacts_clients").select("prenom, nom").eq("id", acces.entite_id).single();
              if (c) name = `${c.prenom} ${c.nom}`;
            }
            return { ...p, user_name: name, user_email: null };
          }

          return { ...p, user_name: "Utilisateur", user_email: null };
        }),
      );

      // Get last message
      const { data: lastMsgs } = await admin
        .from("messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const lastMessage = lastMsgs?.[0] || null;

      // Count unread messages
      const myParticipation = parts?.find((p) => p.user_id === userId);
      let unreadCount = 0;
      if (myParticipation?.dernier_lu_at) {
        const { count } = await admin
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .gt("created_at", myParticipation.dernier_lu_at)
          .neq("sender_id", userId);
        unreadCount = count || 0;
      }

      return {
        ...conv,
        participants: participantsEnriched,
        last_message: lastMessage,
        unread_count: unreadCount,
      } as Conversation;
    }),
  );

  // Sort by last message date
  enriched.sort((a, b) => {
    const dateA = a.last_message?.created_at || a.created_at;
    const dateB = b.last_message?.created_at || b.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  return { data: enriched };
}

// ─── Get messages for a conversation ────────────────────

export async function getConversationMessages(conversationId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [] };
  const { admin, userId, organisationId } = result;

  // Verify user is a participant
  const { data: participation } = await admin
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();

  // Also allow org admins
  if (!participation) {
    const { data: userRecord } = await admin
      .from("utilisateurs")
      .select("organisation_id")
      .eq("id", userId)
      .single();

    if (!userRecord) return { data: [], error: "Non autorisé" };
  }

  const { data: messages, error } = await admin
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) return { data: [] };

  // Enrich with sender names
  const enriched = await Promise.all(
    (messages || []).map(async (msg) => {
      const { data: user } = await admin
        .from("utilisateurs")
        .select("prenom, nom, role")
        .eq("id", msg.sender_id)
        .single();

      if (user) {
        return {
          ...msg,
          sender_name: `${user.prenom || ""} ${user.nom || ""}`.trim(),
          sender_role: user.role,
        };
      }

      // Check extranet
      const { data: acces } = await admin
        .from("extranet_acces")
        .select("role, entite_type, entite_id")
        .eq("user_id", msg.sender_id)
        .eq("organisation_id", organisationId)
        .single();

      if (acces) {
        let name = "Utilisateur";
        if (acces.entite_type === "formateur") {
          const { data: f } = await admin.from("formateurs").select("prenom, nom").eq("id", acces.entite_id).single();
          if (f) name = `${f.prenom} ${f.nom}`;
        } else if (acces.entite_type === "apprenant") {
          const { data: a } = await admin.from("apprenants").select("prenom, nom").eq("id", acces.entite_id).single();
          if (a) name = `${a.prenom} ${a.nom}`;
        } else if (acces.entite_type === "contact_client") {
          const { data: c } = await admin.from("contacts_clients").select("prenom, nom").eq("id", acces.entite_id).single();
          if (c) name = `${c.prenom} ${c.nom}`;
        }
        return { ...msg, sender_name: name, sender_role: acces.role };
      }

      return { ...msg, sender_name: "Utilisateur", sender_role: null };
    }),
  );

  // Mark conversation as read
  await admin
    .from("conversation_participants")
    .update({ dernier_lu_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  return { data: enriched };
}

// ─── Send a message ─────────────────────────────────────

export async function sendMessage(conversationId: string, contenu: string, fichierUrl?: string, fichierNom?: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, userId, organisationId } = result;

  if (!contenu.trim() && !fichierUrl) {
    return { error: "Le message ne peut pas être vide" };
  }

  // Verify participation
  const { data: participation } = await admin
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();

  if (!participation) {
    // Allow org admins
    const { data: userRecord } = await admin
      .from("utilisateurs")
      .select("organisation_id")
      .eq("id", userId)
      .single();
    if (!userRecord) return { error: "Non autorisé" };
  }

  const { data, error } = await admin
    .from("messages")
    .insert({
      organisation_id: organisationId,
      conversation_id: conversationId,
      sender_id: userId,
      contenu: contenu.trim(),
      fichier_url: fichierUrl || null,
      fichier_nom: fichierNom || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Update read marker for sender
  await admin
    .from("conversation_participants")
    .update({ dernier_lu_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  return { data };
}

// ─── Create a direct conversation ───────────────────────

export async function createDirectConversation(targetUserId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, userId, organisationId } = result;

  // Check if a direct conversation already exists between these two users
  const { data: myConvs } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  const { data: theirConvs } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", targetUserId);

  if (myConvs && theirConvs) {
    const myIds = new Set(myConvs.map((c) => c.conversation_id));
    const sharedIds = theirConvs
      .filter((c) => myIds.has(c.conversation_id))
      .map((c) => c.conversation_id);

    if (sharedIds.length > 0) {
      // Check if any of these are direct conversations
      const { data: directConvs } = await admin
        .from("conversations")
        .select("id")
        .in("id", sharedIds)
        .eq("type", "direct");

      if (directConvs && directConvs.length > 0) {
        return { data: { id: directConvs[0].id }, existing: true };
      }
    }
  }

  // Create new conversation
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .insert({
      organisation_id: organisationId,
      type: "direct",
    })
    .select()
    .single();

  if (convError) return { error: convError.message };

  // Add both participants
  const myRole = await getUserRole(admin, userId, organisationId);
  const theirRole = await getUserRole(admin, targetUserId, organisationId);

  await admin.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: userId, role: myRole },
    { conversation_id: conv.id, user_id: targetUserId, role: theirRole },
  ]);

  return { data: conv };
}

// ─── Create a session group conversation ────────────────

export async function createSessionGroupConversation(sessionId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, userId, organisationId } = result;

  // Check if one already exists
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("session_id", sessionId)
    .eq("type", "session_group")
    .single();

  if (existing) {
    return { data: existing, existing: true };
  }

  // Get session info
  const { data: session } = await admin
    .from("sessions")
    .select("nom, session_formateurs(formateur_id, formateurs(extranet_user_id))")
    .eq("id", sessionId)
    .single();

  if (!session) return { error: "Session introuvable" };

  // Create conversation
  const { data: conv, error: convError } = await admin
    .from("conversations")
    .insert({
      organisation_id: organisationId,
      type: "session_group",
      session_id: sessionId,
      titre: `Session : ${session.nom}`,
    })
    .select()
    .single();

  if (convError) return { error: convError.message };

  // Add current user (admin)
  const participants = [
    { conversation_id: conv.id, user_id: userId, role: "admin" },
  ];

  // Add formateurs
  for (const sf of session.session_formateurs || []) {
    const f = sf.formateurs as unknown as { extranet_user_id: string | null } | null;
    if (f?.extranet_user_id) {
      participants.push({
        conversation_id: conv.id,
        user_id: f.extranet_user_id,
        role: "formateur",
      });
    }
  }

  // Add apprenants
  const { data: inscriptions } = await admin
    .from("inscriptions")
    .select("apprenants(extranet_user_id)")
    .eq("session_id", sessionId)
    .neq("statut", "annule");

  for (const ins of inscriptions || []) {
    const a = ins.apprenants as unknown as { extranet_user_id: string | null } | null;
    if (a?.extranet_user_id) {
      participants.push({
        conversation_id: conv.id,
        user_id: a.extranet_user_id,
        role: "apprenant",
      });
    }
  }

  await admin.from("conversation_participants").insert(participants);

  return { data: conv };
}

// ─── Create support conversation ────────────────────────

export async function createSupportConversation(titre?: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, userId, organisationId } = result;

  // Check if an active support conversation already exists
  const { data: myConvs } = await admin
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userId);

  if (myConvs && myConvs.length > 0) {
    const { data: existingSupport } = await admin
      .from("conversations")
      .select("id")
      .in("id", myConvs.map((c) => c.conversation_id))
      .eq("type", "support")
      .limit(1);

    if (existingSupport && existingSupport.length > 0) {
      return { data: existingSupport[0], existing: true };
    }
  }

  const { data: conv, error: convError } = await admin
    .from("conversations")
    .insert({
      organisation_id: organisationId,
      type: "support",
      titre: titre || "Demande de support",
    })
    .select()
    .single();

  if (convError) return { error: convError.message };

  // Add the requester
  const myRole = await getUserRole(admin, userId, organisationId);
  await admin.from("conversation_participants").insert({
    conversation_id: conv.id,
    user_id: userId,
    role: myRole,
  });

  // Add all org admins
  const { data: admins } = await admin
    .from("utilisateurs")
    .select("id")
    .eq("organisation_id", organisationId)
    .eq("role", "admin")
    .eq("actif", true);

  for (const adm of admins || []) {
    if (adm.id !== userId) {
      await admin.from("conversation_participants").insert({
        conversation_id: conv.id,
        user_id: adm.id,
        role: "admin",
      });
    }
  }

  return { data: conv };
}

// ─── Mark conversation as read ──────────────────────────

export async function markConversationAsRead(conversationId: string) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { admin, userId } = result;

  await admin
    .from("conversation_participants")
    .update({ dernier_lu_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);

  return { success: true };
}

// ─── Get unread count ───────────────────────────────────

export async function getUnreadMessageCount() {
  const result = await getOrganisationId();
  if ("error" in result) return { count: 0 };
  const { admin, userId } = result;

  const { data: participations } = await admin
    .from("conversation_participants")
    .select("conversation_id, dernier_lu_at")
    .eq("user_id", userId);

  if (!participations || participations.length === 0) return { count: 0 };

  let total = 0;
  for (const p of participations) {
    if (p.dernier_lu_at) {
      const { count } = await admin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", p.conversation_id)
        .gt("created_at", p.dernier_lu_at)
        .neq("sender_id", userId);
      total += count || 0;
    }
  }

  return { count: total };
}

// ─── Helper: determine user role ────────────────────────

async function getUserRole(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  userId: string,
  organisationId: string,
): Promise<string> {
  const { data: user } = await admin
    .from("utilisateurs")
    .select("role")
    .eq("id", userId)
    .single();

  if (user) return user.role || "admin";

  const { data: acces } = await admin
    .from("extranet_acces")
    .select("role")
    .eq("user_id", userId)
    .eq("organisation_id", organisationId)
    .single();

  return acces?.role || "unknown";
}
