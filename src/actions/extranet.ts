"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { z } from "zod";

const TABLE_MAP: Record<string, string> = {
  formateur: "formateurs",
  apprenant: "apprenants",
  contact_client: "contacts_clients",
};

const InviteSchema = z.object({
  entiteType: z.enum(["formateur", "apprenant", "contact_client"]),
  entiteId: z.string().uuid(),
  email: z.string().email("Email invalide"),
  prenom: z.string().min(1),
  nom: z.string().min(1),
});

export type InviteInput = z.infer<typeof InviteSchema>;

/**
 * Get the current authenticated user id, or return an error.
 */
async function requireAuth(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }
  return { userId: user.id };
}

/**
 * Get organisation_id from the entity itself (formateur/apprenant/contact_client).
 * This is more resilient than looking up through utilisateurs table.
 */
async function getOrganisationIdFromEntity(
  entiteType: string,
  entiteId: string
): Promise<string | null> {
  const admin = createAdminClient();
  const tableName = TABLE_MAP[entiteType];
  if (!tableName) return null;

  const { data, error } = await admin
    .from(tableName)
    .select("organisation_id")
    .eq("id", entiteId)
    .single();

  if (error) {
    console.error(`[extranet] getOrganisationIdFromEntity error:`, error.message);
    return null;
  }

  return (data as { organisation_id: string } | null)?.organisation_id ?? null;
}

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
  try {
    const parsed = InviteSchema.safeParse(input);
    if (!parsed.success) {
      const firstError = Object.values(parsed.error.flatten().fieldErrors)[0];
      return { error: firstError?.[0] || "Données invalides" };
    }

    const authCheck = await requireAuth();
    if ("error" in authCheck) {
      return { error: authCheck.error };
    }

    const { entiteType, entiteId, email, prenom, nom } = parsed.data;
    const admin = createAdminClient();

    // Get organisation_id from the entity itself
    const organisationId = await getOrganisationIdFromEntity(entiteType, entiteId);
    if (!organisationId) {
      return { error: "Entité introuvable ou sans organisation" };
    }

    // Map entiteType to the extranet role
    const role = entiteType; // formateur, apprenant, contact_client

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

    // 1. Check if auth user exists with this email, or create one
    let authUserId: string;

    // Try to find by email using admin API
    const { data: userListData, error: listError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("[extranet] listUsers error:", listError.message);
      return { error: `Erreur listing utilisateurs : ${listError.message}` };
    }

    const existingUser = userListData?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingUser) {
      authUserId = existingUser.id;
    } else {
      // Create auth user with a temporary password (they'll set their own via email link)
      const tempPassword = randomUUID();
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { prenom, nom, extranet_role: role },
      });

      if (authError) {
        console.error("[extranet] createUser error:", authError.message);
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
        console.error("[extranet] update extranet_acces error:", updateError.message, updateError.details, updateError.hint);
        return { error: `Erreur mise à jour accès : ${updateError.message}` };
      }
    } else {
      const insertPayload = {
        organisation_id: organisationId,
        user_id: authUserId,
        role,
        entite_type: entiteType,
        entite_id: entiteId,
        statut: "invite",
        invite_le: new Date().toISOString(),
      };
      console.log("[extranet] INSERT extranet_acces payload:", JSON.stringify(insertPayload));

      const { error: insertError } = await admin
        .from("extranet_acces")
        .insert(insertPayload);

      if (insertError) {
        console.error("[extranet] insert extranet_acces error:", insertError.message, insertError.details, insertError.hint, insertError.code);
        return { error: `Erreur création accès : ${insertError.message}` };
      }
    }

    // 3. Update the entity's extranet fields
    const tableName = TABLE_MAP[entiteType];

    const { error: entityError } = await admin
      .from(tableName)
      .update({
        extranet_actif: true,
        extranet_user_id: authUserId,
      })
      .eq("id", entiteId);

    if (entityError) {
      console.error("[extranet] update entity error:", entityError.message, entityError.details);
      return { error: `Erreur mise à jour fiche : ${entityError.message}` };
    }

    // 4. Generate a login link for the invited user
    // When Resend is set up, this link will be sent by email automatically.
    // For now, we return it so the admin can copy/share it manually.
    let loginLink: string | null = null;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError) {
      console.error("[extranet] generateLink error:", linkError.message);
      // Not a blocking error — the account is created, just no link
    } else if (linkData?.properties?.action_link) {
      loginLink = linkData.properties.action_link;
    }

    return { success: true, userId: authUserId, loginLink };
  } catch (err) {
    console.error("[extranet] inviteToExtranet unexpected error:", err);
    return { error: `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Revoke extranet access for a person.
 */
export async function revokeExtranetAccess(extranetAccesId: string) {
  try {
    const authCheck = await requireAuth();
    if ("error" in authCheck) {
      return { error: authCheck.error };
    }

    const admin = createAdminClient();

    const { data: acces, error: fetchError } = await admin
      .from("extranet_acces")
      .select("id, entite_type, entite_id, organisation_id")
      .eq("id", extranetAccesId)
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
      return { error: `Erreur révocation : ${updateError.message}` };
    }

    // Update entity's extranet fields
    const tableName = TABLE_MAP[acces.entite_type];

    await admin
      .from(tableName)
      .update({ extranet_actif: false })
      .eq("id", acces.entite_id);

    return { success: true };
  } catch (err) {
    console.error("[extranet] revokeExtranetAccess error:", err);
    return { error: `Erreur inattendue : ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Get extranet access status for an entity.
 */
export async function getExtranetAccess(entiteType: string, entiteId: string) {
  try {
    const authCheck = await requireAuth();
    if ("error" in authCheck) {
      return { acces: null };
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("extranet_acces")
      .select("id, user_id, role, statut, invite_le, active_le")
      .eq("entite_type", entiteType)
      .eq("entite_id", entiteId)
      .single();

    if (error || !data) {
      return { acces: null };
    }

    return { acces: data };
  } catch (err) {
    console.error("[extranet] getExtranetAccess error:", err);
    return { acces: null };
  }
}
