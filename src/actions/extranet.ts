"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganisationId } from "@/lib/auth-helpers";
import { z } from "zod";

const InviteSchema = z.object({
  entiteType: z.enum(["formateur", "apprenant", "contact_client"]),
  entiteId: z.string().uuid(),
  email: z.string().email("Email invalide"),
  prenom: z.string().min(1),
  nom: z.string().min(1),
});

export type InviteInput = z.infer<typeof InviteSchema>;

/**
 * Invite a formateur, apprenant, or contact client to the extranet.
 *
 * Flow:
 * 1. Create auth.users account with the person's email
 * 2. Create extranet_acces entry (role, entite_type, entite_id, statut='invite')
 * 3. Update the entity's extranet fields (extranet_actif, extranet_user_id)
 * 4. TODO: Send invitation email via Resend with a first-access link
 */
export async function inviteToExtranet(input: InviteInput) {
  const parsed = InviteSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0];
    return { error: firstError?.[0] || "Données invalides" };
  }

  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const { organisationId } = authResult;
  const { entiteType, entiteId, email, prenom, nom } = parsed.data;
  const admin = createAdminClient();

  // Map entiteType to the extranet role
  const roleMap: Record<string, string> = {
    formateur: "formateur",
    apprenant: "apprenant",
    contact_client: "contact_client",
  };
  const role = roleMap[entiteType];

  // Check if already invited
  const { data: existingAcces } = await admin
    .from("extranet_acces")
    .select("id, statut")
    .eq("organisation_id", organisationId)
    .eq("entite_type", entiteType)
    .eq("entite_id", entiteId)
    .single();

  if (existingAcces) {
    if (existingAcces.statut === "actif") {
      return { error: "Cette personne a déjà un accès extranet actif" };
    }
    if (existingAcces.statut === "invite") {
      return { error: "Une invitation est déjà en cours pour cette personne" };
    }
  }

  // 1. Check if auth user exists with this email
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find((u) => u.email === email);

  let authUserId: string;

  if (existingUser) {
    authUserId = existingUser.id;
  } else {
    // Create auth user with a temporary password (they'll set their own via email link)
    const tempPassword = crypto.randomUUID();
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { prenom, nom, extranet_role: role },
    });

    if (authError) {
      return { error: `Erreur création du compte : ${authError.message}` };
    }
    authUserId = authData.user.id;
  }

  // 2. Create or update extranet_acces entry
  if (existingAcces) {
    const { error: updateError } = await admin
      .from("extranet_acces")
      .update({
        user_id: authUserId,
        statut: "invite",
        invite_le: new Date().toISOString(),
      })
      .eq("id", existingAcces.id);

    if (updateError) {
      return { error: "Erreur lors de la mise à jour de l'accès extranet" };
    }
  } else {
    const { error: insertError } = await admin
      .from("extranet_acces")
      .insert({
        organisation_id: organisationId,
        user_id: authUserId,
        role,
        entite_type: entiteType,
        entite_id: entiteId,
        statut: "invite",
        invite_le: new Date().toISOString(),
      });

    if (insertError) {
      return { error: "Erreur lors de la création de l'accès extranet" };
    }
  }

  // 3. Update the entity's extranet fields
  const tableMap: Record<string, string> = {
    formateur: "formateurs",
    apprenant: "apprenants",
    contact_client: "contacts_clients",
  };
  const tableName = tableMap[entiteType];

  const { error: entityError } = await admin
    .from(tableName)
    .update({
      extranet_actif: true,
      extranet_user_id: authUserId,
    })
    .eq("id", entiteId);

  if (entityError) {
    return { error: "Erreur lors de la mise à jour de la fiche" };
  }

  // 4. TODO: Send invitation email via Resend
  // For now, the user account is created and ready

  return { success: true, userId: authUserId };
}

/**
 * Revoke extranet access for a person.
 */
export async function revokeExtranetAccess(extranetAccesId: string) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const admin = createAdminClient();

  const { data: acces, error: fetchError } = await admin
    .from("extranet_acces")
    .select("id, entite_type, entite_id")
    .eq("id", extranetAccesId)
    .eq("organisation_id", authResult.organisationId)
    .single();

  if (fetchError || !acces) {
    return { error: "Accès extranet non trouvé" };
  }

  // Update status to disabled
  const { error: updateError } = await admin
    .from("extranet_acces")
    .update({ statut: "desactive" })
    .eq("id", extranetAccesId);

  if (updateError) {
    return { error: "Erreur lors de la révocation" };
  }

  // Update entity's extranet fields
  const tableMap: Record<string, string> = {
    formateur: "formateurs",
    apprenant: "apprenants",
    contact_client: "contacts_clients",
  };
  const tableName = tableMap[acces.entite_type];

  await admin
    .from(tableName)
    .update({ extranet_actif: false })
    .eq("id", acces.entite_id);

  return { success: true };
}

/**
 * Get extranet access status for an entity.
 */
export async function getExtranetAccess(entiteType: string, entiteId: string) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return { error: authResult.error };
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("extranet_acces")
    .select("id, user_id, role, statut, invite_le, active_le")
    .eq("organisation_id", authResult.organisationId)
    .eq("entite_type", entiteType)
    .eq("entite_id", entiteId)
    .single();

  if (error || !data) {
    return { acces: null };
  }

  return { acces: data };
}
