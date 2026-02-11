import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ──────────────────────────────────────────────

export type HistoriqueModule =
  | "entreprise"
  | "apprenant"
  | "contact_client"
  | "formateur"
  | "financeur"
  | "produit"
  | "session"
  | "inscription"
  | "devis"
  | "facture"
  | "avoir"
  | "tache"
  | "activite"
  | "salle"
  | "email"
  | "organisation"
  | "questionnaire"
  | "opportunite"
  | "ticket"
  | "document";

export type HistoriqueAction =
  | "created"
  | "updated"
  | "archived"
  | "unarchived"
  | "deleted"
  | "status_changed"
  | "linked"
  | "unlinked"
  | "imported"
  | "sent"
  | "signed"
  | "completed"
  | "generated"
  | "replied"
  | "assigned"
  | "alert_triggered";

export type HistoriqueOrigine = "backoffice" | "extranet" | "systeme";

export interface HistoriqueEvent {
  id: string;
  date: string;
  module: HistoriqueModule;
  action: HistoriqueAction;
  description: string;
  entite_label: string | null;
  entite_id: string | null;
  objet_href: string | null;
  user_nom: string | null;
  user_role: string | null;
  origine: HistoriqueOrigine;
  agence_nom: string | null;
  metadata: Record<string, unknown> | null;
}

export interface HistoriqueFilters {
  module?: HistoriqueModule;
  action?: HistoriqueAction;
  origine?: HistoriqueOrigine;
  utilisateur?: string;
  date_debut?: string;
  date_fin?: string;
}

export interface LogHistoriqueParams {
  organisationId: string;
  userId: string | null;
  userNom?: string | null;
  userRole?: string | null;
  origine?: HistoriqueOrigine;
  module: HistoriqueModule;
  action: HistoriqueAction;
  entiteType: string;
  entiteId: string;
  entiteLabel?: string | null;
  entrepriseId?: string | null;
  description: string;
  objetHref?: string | null;
  metadata?: Record<string, unknown>;
  agenceId?: string | null;
  agenceNom?: string | null;
}

// ─── Main logging function ──────────────────────────────

/**
 * Log an event to the historique_events table.
 * Uses the admin client (service_role) to bypass RLS.
 * Non-blocking: errors are silently logged, never thrown.
 *
 * Usage:
 * ```ts
 * await logHistorique({
 *   organisationId,
 *   userId,
 *   module: "entreprise",
 *   action: "created",
 *   entiteType: "entreprise",
 *   entiteId: data.id,
 *   entiteLabel: `${data.numero_affichage} — ${data.nom}`,
 *   description: `Entreprise "${data.nom}" créée`,
 *   objetHref: `/entreprises/${data.id}`,
 * });
 * ```
 */
export async function logHistorique(params: LogHistoriqueParams): Promise<void> {
  try {
    const admin = createAdminClient();

    await admin.from("historique_events").insert({
      organisation_id: params.organisationId,
      user_id: params.userId,
      user_nom: params.userNom ?? null,
      user_role: params.userRole ?? null,
      origine: params.origine ?? "backoffice",
      module: params.module,
      action: params.action,
      entite_type: params.entiteType,
      entite_id: params.entiteId,
      entite_label: params.entiteLabel ?? null,
      entreprise_id: params.entrepriseId ?? null,
      description: params.description,
      objet_href: params.objetHref ?? null,
      metadata: params.metadata ?? {},
      agence_id: params.agenceId ?? null,
      agence_nom: params.agenceNom ?? null,
    });
  } catch {
    // Silently fail — historique logging must never break the main action
    console.error("[historique] Failed to log event:", params.description);
  }
}

// ─── Batch logging (for bulk operations) ────────────────

/**
 * Log multiple events at once (e.g., bulk delete, import).
 */
export async function logHistoriqueBatch(
  events: LogHistoriqueParams[],
): Promise<void> {
  if (events.length === 0) return;

  try {
    const admin = createAdminClient();

    await admin.from("historique_events").insert(
      events.map((params) => ({
        organisation_id: params.organisationId,
        user_id: params.userId,
        user_nom: params.userNom ?? null,
        user_role: params.userRole ?? null,
        origine: params.origine ?? "backoffice",
        module: params.module,
        action: params.action,
        entite_type: params.entiteType,
        entite_id: params.entiteId,
        entite_label: params.entiteLabel ?? null,
        entreprise_id: params.entrepriseId ?? null,
        description: params.description,
        objet_href: params.objetHref ?? null,
        metadata: params.metadata ?? {},
        agence_id: params.agenceId ?? null,
        agence_nom: params.agenceNom ?? null,
      })),
    );
  } catch {
    console.error("[historique] Failed to log batch events");
  }
}

// ─── Helper: compute changed fields for updates ─────────

/**
 * Compare old and new values to compute a diff for metadata.
 * Returns { changed_fields, old_values, new_values } for the metadata field.
 */
export function computeChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldLabels?: Record<string, string>,
): { changed_fields: string[]; old_values: Record<string, unknown>; new_values: Record<string, unknown> } {
  const changed_fields: string[] = [];
  const old_values: Record<string, unknown> = {};
  const new_values: Record<string, unknown> = {};

  for (const key of Object.keys(newData)) {
    if (key === "updated_at" || key === "created_at") continue;
    const oldVal = oldData[key] ?? null;
    const newVal = newData[key] ?? null;
    if (oldVal !== newVal && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      const label = fieldLabels?.[key] ?? key;
      changed_fields.push(label);
      old_values[key] = oldVal;
      new_values[key] = newVal;
    }
  }

  return { changed_fields, old_values, new_values };
}
