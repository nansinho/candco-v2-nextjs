import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auto-create a facture from a signed devis.
 * Used by: Documenso webhook, checkDevisSignatureStatus polling, and manual trigger.
 * This is in a separate utility file to avoid circular imports between devis.ts and signatures.ts.
 */
export async function autoCreateFactureFromDevis(devisId: string, organisationId: string) {
  const admin = createAdminClient();

  // Check if facture already exists for this devis
  const { data: existingFacture } = await admin
    .from("factures")
    .select("id")
    .eq("devis_id", devisId)
    .maybeSingle();

  if (existingFacture) return { skipped: true, factureId: existingFacture.id };

  // Fetch devis with lines
  const { data: devisData } = await admin
    .from("devis")
    .select(`
      *,
      devis_lignes(designation, description, quantite, prix_unitaire_ht, taux_tva, montant_ht, ordre)
    `)
    .eq("id", devisId)
    .single();

  if (!devisData) return { error: "Devis introuvable" };

  // Generate facture number
  const { data: numero } = await admin.rpc("next_numero", {
    p_organisation_id: organisationId,
    p_entite: "F",
    p_year: new Date().getFullYear(),
  });

  const { data: facture, error } = await admin
    .from("factures")
    .insert({
      organisation_id: organisationId,
      numero_affichage: numero,
      entreprise_id: devisData.entreprise_id,
      contact_client_id: devisData.contact_client_id,
      date_emission: new Date().toISOString().split("T")[0],
      date_echeance: null,
      objet: devisData.objet,
      conditions_paiement: devisData.conditions,
      mentions_legales: devisData.mentions_legales,
      total_ht: devisData.total_ht,
      total_tva: devisData.total_tva,
      total_ttc: devisData.total_ttc,
      statut: "brouillon",
      devis_id: devisId,
      session_id: devisData.session_id,
      commanditaire_id: devisData.commanditaire_id || null,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  // Copy lines
  const lignes = ((devisData.devis_lignes || []) as Record<string, unknown>[]);
  if (lignes.length > 0) {
    await admin.from("facture_lignes").insert(
      lignes.map((l) => ({
        facture_id: facture.id,
        designation: l.designation,
        description: l.description ?? null,
        quantite: l.quantite,
        prix_unitaire_ht: l.prix_unitaire_ht,
        taux_tva: l.taux_tva,
        montant_ht: l.montant_ht,
        ordre: l.ordre,
      })),
    );
  }

  await admin.from("historique_events").insert({
    organisation_id: organisationId,
    module: "facture",
    action: "created",
    entite_type: "facture",
    entite_id: facture.id,
    description: `Facture ${facture.numero_affichage} créée automatiquement depuis devis signé ${devisData.numero_affichage}`,
  });

  return { factureId: facture.id, factureNumero: facture.numero_affichage };
}
