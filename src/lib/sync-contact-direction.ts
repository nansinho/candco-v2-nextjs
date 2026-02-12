/**
 * Synchronisation automatique : Contacts clients ↔ Apprenants avec rôle "Direction"
 *
 * Quand un apprenant reçoit le rôle "direction" dans l'organigramme d'une entreprise,
 * un contact client est automatiquement créé (ou adopté) et lié à l'entreprise.
 *
 * - Création automatique avec déduplication (email, puis nom+prénom+entreprise)
 * - Mise à jour automatique des champs synchronisés
 * - Archivage automatique si le rôle "direction" est retiré
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { logHistorique } from "@/lib/historique";
import { revalidatePath } from "next/cache";

// ─── Types ───────────────────────────────────────────────

interface SyncContext {
  admin: SupabaseClient;
  organisationId: string;
  userId: string;
  role: string;
}

interface SyncParams extends SyncContext {
  apprenantId: string;
  entrepriseId: string;
  fonction: string | null;
}

interface UnsyncParams extends SyncContext {
  apprenantId: string;
  entrepriseId: string;
}

interface SyncFieldsParams {
  admin: SupabaseClient;
  apprenantId: string;
  fields: {
    prenom?: string;
    nom?: string;
    email?: string | null;
    telephone?: string | null;
    civilite?: string | null;
  };
}

// ─── Main sync function ──────────────────────────────────

/**
 * Synchronise un apprenant → contact client quand il reçoit le rôle "direction".
 *
 * 1. Vérifie si un contact synchronisé existe déjà pour cet apprenant
 * 2. Si non, déduplique par email puis par nom+prénom+entreprise
 * 3. Crée ou adopte le contact, et crée le lien contact_entreprises
 */
export async function syncContactForDirectionMembre({
  admin,
  organisationId,
  userId,
  role,
  apprenantId,
  entrepriseId,
  fonction,
}: SyncParams): Promise<void> {
  try {
    // 1. Fetch apprenant data
    const { data: apprenant } = await admin
      .from("apprenants")
      .select("id, prenom, nom, email, telephone, civilite")
      .eq("id", apprenantId)
      .single();

    if (!apprenant) {
      console.error("[syncContactDirection] Apprenant introuvable:", apprenantId);
      return;
    }

    const contactFonction = fonction || "Direction";

    // 2. Check if a synced contact already exists for this apprenant
    const { data: existingSynced } = await admin
      .from("contacts_clients")
      .select("id, archived_at")
      .eq("organisation_id", organisationId)
      .eq("sync_source_apprenant_id", apprenantId)
      .maybeSingle();

    if (existingSynced) {
      // Contact already exists — update fields and ensure entreprise link
      await admin
        .from("contacts_clients")
        .update({
          prenom: apprenant.prenom,
          nom: apprenant.nom,
          email: apprenant.email,
          telephone: apprenant.telephone,
          civilite: apprenant.civilite,
          fonction: contactFonction,
          // Un-archive if it was archived (e.g., role was removed then re-added)
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingSynced.id);

      await ensureContactEntrepriseLink(admin, existingSynced.id, entrepriseId);
      revalidatePath("/contacts-clients");
      return;
    }

    // 3. Deduplication: try to find an existing contact to "adopt"
    let adoptedContactId: string | null = null;

    // 3a. Deduplicate by email
    if (apprenant.email) {
      const { data: byEmail } = await admin
        .from("contacts_clients")
        .select("id")
        .eq("organisation_id", organisationId)
        .eq("email", apprenant.email)
        .is("sync_source_apprenant_id", null)
        .maybeSingle();

      if (byEmail) {
        adoptedContactId = byEmail.id;
      }
    }

    // 3b. Deduplicate by prenom+nom linked to same entreprise
    if (!adoptedContactId) {
      const { data: byName } = await admin
        .from("contacts_clients")
        .select("id, contact_entreprises!inner(entreprise_id)")
        .eq("organisation_id", organisationId)
        .ilike("prenom", apprenant.prenom)
        .ilike("nom", apprenant.nom)
        .eq("contact_entreprises.entreprise_id", entrepriseId)
        .is("sync_source_apprenant_id", null)
        .maybeSingle();

      if (byName) {
        adoptedContactId = byName.id;
      }
    }

    if (adoptedContactId) {
      // Adopt existing contact: set sync source + update fields
      await admin
        .from("contacts_clients")
        .update({
          sync_source_apprenant_id: apprenantId,
          prenom: apprenant.prenom,
          nom: apprenant.nom,
          email: apprenant.email,
          telephone: apprenant.telephone,
          civilite: apprenant.civilite,
          fonction: contactFonction,
          archived_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adoptedContactId);

      await ensureContactEntrepriseLink(admin, adoptedContactId, entrepriseId);

      await logHistorique({
        organisationId,
        userId,
        userRole: role,
        module: "contact_client",
        action: "updated",
        entiteType: "contact_client",
        entiteId: adoptedContactId,
        description: `Contact client adopté par synchronisation depuis l'apprenant "${apprenant.prenom} ${apprenant.nom}" (rôle Direction)`,
        objetHref: `/contacts-clients/${adoptedContactId}`,
      });

      revalidatePath("/contacts-clients");
      return;
    }

    // 4. No existing contact found → create a new one
    // Generate numero_affichage
    const { data: nextNum } = await admin.rpc("next_numero", {
      p_organisation_id: organisationId,
      p_entite: "CTC",
    });

    const numeroAffichage = nextNum || "CTC-????";

    const { data: newContact, error: createError } = await admin
      .from("contacts_clients")
      .insert({
        organisation_id: organisationId,
        numero_affichage: numeroAffichage,
        civilite: apprenant.civilite,
        prenom: apprenant.prenom,
        nom: apprenant.nom,
        email: apprenant.email,
        telephone: apprenant.telephone,
        fonction: contactFonction,
        sync_source_apprenant_id: apprenantId,
      })
      .select("id")
      .single();

    if (createError || !newContact) {
      console.error("[syncContactDirection] Erreur création contact:", createError?.message);
      return;
    }

    // Create contact_entreprises link
    await ensureContactEntrepriseLink(admin, newContact.id, entrepriseId);

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "contact_client",
      action: "created",
      entiteType: "contact_client",
      entiteId: newContact.id,
      entiteLabel: `${numeroAffichage} — ${apprenant.prenom} ${apprenant.nom}`,
      description: `Contact client "${apprenant.prenom} ${apprenant.nom}" créé automatiquement (apprenant avec rôle Direction)`,
      objetHref: `/contacts-clients/${newContact.id}`,
    });

    revalidatePath("/contacts-clients");
  } catch (err) {
    console.error("[syncContactDirection] Unexpected error:", err);
  }
}

// ─── Unsync function ─────────────────────────────────────

/**
 * Désynchronise un contact client quand le rôle "direction" est retiré.
 *
 * 1. Retire le lien contact_entreprises pour cette entreprise
 * 2. Vérifie si l'apprenant a encore le rôle "direction" dans d'autres entreprises
 * 3. Si non → archive le contact client
 */
export async function unsyncContactForDirectionMembre({
  admin,
  organisationId,
  userId,
  role,
  apprenantId,
  entrepriseId,
}: UnsyncParams): Promise<void> {
  try {
    // 1. Find the synced contact
    const { data: syncedContact } = await admin
      .from("contacts_clients")
      .select("id, numero_affichage, prenom, nom")
      .eq("organisation_id", organisationId)
      .eq("sync_source_apprenant_id", apprenantId)
      .maybeSingle();

    if (!syncedContact) return;

    // 2. Remove the contact_entreprises link for this specific enterprise
    await admin
      .from("contact_entreprises")
      .delete()
      .eq("contact_client_id", syncedContact.id)
      .eq("entreprise_id", entrepriseId);

    // 3. Check if the apprenant still has "direction" role in any other enterprise
    const { data: otherDirectionMembres } = await admin
      .from("entreprise_membres")
      .select("id, entreprise_id")
      .eq("apprenant_id", apprenantId)
      .neq("entreprise_id", entrepriseId)
      .contains("roles", ["direction"]);

    if (otherDirectionMembres && otherDirectionMembres.length > 0) {
      // Still has direction role elsewhere — keep contact active, just removed this entreprise link
      revalidatePath("/contacts-clients");
      return;
    }

    // 4. No more direction roles → archive the contact
    await admin
      .from("contacts_clients")
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", syncedContact.id);

    await logHistorique({
      organisationId,
      userId,
      userRole: role,
      module: "contact_client",
      action: "archived",
      entiteType: "contact_client",
      entiteId: syncedContact.id,
      entiteLabel: `${syncedContact.numero_affichage} — ${syncedContact.prenom} ${syncedContact.nom}`,
      description: `Contact client "${syncedContact.prenom} ${syncedContact.nom}" archivé automatiquement (rôle Direction retiré)`,
      objetHref: `/contacts-clients/${syncedContact.id}`,
    });

    revalidatePath("/contacts-clients");
  } catch (err) {
    console.error("[unsyncContactDirection] Unexpected error:", err);
  }
}

// ─── Field propagation ───────────────────────────────────

/**
 * Propage les modifications de champs d'un apprenant vers les contacts clients synchronisés.
 * Appelé depuis updateApprenant().
 */
export async function syncContactFieldsFromApprenant({
  admin,
  apprenantId,
  fields,
}: SyncFieldsParams): Promise<void> {
  try {
    // Find all synced contacts for this apprenant
    const { data: syncedContacts } = await admin
      .from("contacts_clients")
      .select("id")
      .eq("sync_source_apprenant_id", apprenantId);

    if (!syncedContacts || syncedContacts.length === 0) return;

    // Build update payload with only defined fields
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (fields.prenom !== undefined) updatePayload.prenom = fields.prenom;
    if (fields.nom !== undefined) updatePayload.nom = fields.nom;
    if (fields.email !== undefined) updatePayload.email = fields.email;
    if (fields.telephone !== undefined) updatePayload.telephone = fields.telephone;
    if (fields.civilite !== undefined) updatePayload.civilite = fields.civilite;

    // Update all synced contacts
    for (const contact of syncedContacts) {
      await admin
        .from("contacts_clients")
        .update(updatePayload)
        .eq("id", contact.id);
    }

    revalidatePath("/contacts-clients");
  } catch (err) {
    console.error("[syncContactFields] Unexpected error:", err);
  }
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Assure qu'un lien contact_entreprises existe (upsert).
 */
async function ensureContactEntrepriseLink(
  admin: SupabaseClient,
  contactClientId: string,
  entrepriseId: string
): Promise<void> {
  const { error } = await admin
    .from("contact_entreprises")
    .upsert(
      { contact_client_id: contactClientId, entreprise_id: entrepriseId },
      { onConflict: "contact_client_id,entreprise_id", ignoreDuplicates: true }
    );

  if (error) {
    console.error("[ensureContactEntrepriseLink] Error:", error.message);
  }
}
