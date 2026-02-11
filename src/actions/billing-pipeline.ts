"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { createClient } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────

export interface CommanditairePipeline {
  commanditaire: {
    id: string;
    entreprise_id: string | null;
    entreprise_nom: string | null;
    contact_client_id: string | null;
    contact_nom: string | null;
    financeur_id: string | null;
    financeur_nom: string | null;
    budget: number;
    subrogation_mode: string;
    montant_entreprise: number;
    montant_financeur: number;
    facturer_entreprise: boolean;
    facturer_financeur: boolean;
    statut_workflow: string;
    convention_statut: string;
    convention_signee: boolean;
    convention_pdf_url: string | null;
    documenso_status: string | null;
  };
  devis: {
    id: string;
    numero_affichage: string;
    statut: string;
    total_ttc: number;
    date_emission: string;
    objet: string | null;
  }[];
  factures: {
    id: string;
    numero_affichage: string;
    statut: string;
    type_facture: string;
    total_ttc: number;
    montant_paye: number;
    date_emission: string;
    objet: string | null;
    pourcentage_acompte: number | null;
  }[];
  avoirs: {
    id: string;
    numero_affichage: string;
    statut: string;
    total_ttc: number;
    date_emission: string;
    motif: string | null;
  }[];
  totaux: {
    budget: number;
    totalDevis: number;
    totalFacture: number;
    totalPaye: number;
    totalAvoir: number;
    resteAFacturer: number;
    resteAPayer: number;
  };
}

export interface SessionBillingPipeline {
  sessionId: string;
  commanditaires: CommanditairePipeline[];
  totaux: {
    budget: number;
    totalFacture: number;
    totalPaye: number;
    totalAvoir: number;
  };
}

// ─── Main query ─────────────────────────────────────────

export async function getSessionBillingPipeline(
  sessionId: string,
): Promise<{ data?: SessionBillingPipeline; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { supabase } = result;

  // Fetch commanditaires with relations
  const { data: commanditaires, error: cmdError } = await supabase
    .from("session_commanditaires")
    .select(`
      id, entreprise_id, contact_client_id, financeur_id,
      budget, statut_workflow, notes,
      subrogation_mode, montant_entreprise, montant_financeur,
      facturer_entreprise, facturer_financeur,
      convention_statut, convention_signee, convention_pdf_url,
      convention_generated_at, convention_sent_at, convention_signed_at,
      documenso_status,
      entreprises(id, nom),
      contacts_clients(id, prenom, nom),
      financeurs(id, nom)
    `)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (cmdError) return { error: cmdError.message };

  // Fetch all devis linked to this session with commanditaire_id
  const { data: allDevis } = await supabase
    .from("devis")
    .select("id, numero_affichage, statut, total_ttc, date_emission, objet, commanditaire_id")
    .eq("session_id", sessionId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  // Fetch all factures linked to this session
  const { data: allFactures } = await supabase
    .from("factures")
    .select("id, numero_affichage, statut, type_facture, total_ttc, montant_paye, date_emission, objet, commanditaire_id, pourcentage_acompte")
    .eq("session_id", sessionId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  // Fetch all avoirs linked to this session (through factures)
  const factureIds = (allFactures ?? []).map((f) => f.id);
  let allAvoirs: { id: string; numero_affichage: string; statut: string; total_ttc: number; date_emission: string; motif: string | null; facture_id: string | null; commanditaire_id: string | null }[] = [];
  if (factureIds.length > 0) {
    const { data: avoirs } = await supabase
      .from("avoirs")
      .select("id, numero_affichage, statut, total_ttc, date_emission, motif, facture_id, commanditaire_id")
      .in("facture_id", factureIds)
      .is("archived_at", null);
    allAvoirs = avoirs ?? [];
  }

  // Build per-commanditaire pipeline
  const pipelines: CommanditairePipeline[] = (commanditaires ?? []).map((cmd) => {
    const entreprise = cmd.entreprises as unknown as { id: string; nom: string } | null;
    const contact = cmd.contacts_clients as unknown as { id: string; prenom: string; nom: string } | null;
    const financeur = cmd.financeurs as unknown as { id: string; nom: string } | null;

    const cmdDevis = (allDevis ?? []).filter((d) => d.commanditaire_id === cmd.id);
    const cmdFactures = (allFactures ?? []).filter((f) => f.commanditaire_id === cmd.id);
    const cmdFactureIds = cmdFactures.map((f) => f.id);
    const cmdAvoirs = allAvoirs.filter(
      (a) => a.commanditaire_id === cmd.id || (a.facture_id && cmdFactureIds.includes(a.facture_id)),
    );

    const budget = Number(cmd.budget) || 0;
    const totalDevis = cmdDevis.reduce((sum, d) => sum + (Number(d.total_ttc) || 0), 0);
    const totalFacture = cmdFactures.reduce((sum, f) => sum + (Number(f.total_ttc) || 0), 0);
    const totalPaye = cmdFactures.reduce((sum, f) => sum + (Number(f.montant_paye) || 0), 0);
    const totalAvoir = cmdAvoirs.reduce((sum, a) => sum + (Number(a.total_ttc) || 0), 0);

    return {
      commanditaire: {
        id: cmd.id,
        entreprise_id: cmd.entreprise_id,
        entreprise_nom: entreprise?.nom ?? null,
        contact_client_id: cmd.contact_client_id,
        contact_nom: contact ? `${contact.prenom} ${contact.nom}` : null,
        financeur_id: cmd.financeur_id,
        financeur_nom: financeur?.nom ?? null,
        budget,
        subrogation_mode: cmd.subrogation_mode ?? "direct",
        montant_entreprise: Number(cmd.montant_entreprise) || 0,
        montant_financeur: Number(cmd.montant_financeur) || 0,
        facturer_entreprise: cmd.facturer_entreprise ?? true,
        facturer_financeur: cmd.facturer_financeur ?? false,
        statut_workflow: cmd.statut_workflow ?? "analyse",
        convention_statut: cmd.convention_statut ?? "aucune",
        convention_signee: cmd.convention_signee ?? false,
        convention_pdf_url: cmd.convention_pdf_url ?? null,
        documenso_status: cmd.documenso_status ?? null,
      },
      devis: cmdDevis.map((d) => ({
        id: d.id,
        numero_affichage: d.numero_affichage,
        statut: d.statut,
        total_ttc: Number(d.total_ttc) || 0,
        date_emission: d.date_emission,
        objet: d.objet,
      })),
      factures: cmdFactures.map((f) => ({
        id: f.id,
        numero_affichage: f.numero_affichage,
        statut: f.statut,
        type_facture: f.type_facture ?? "standard",
        total_ttc: Number(f.total_ttc) || 0,
        montant_paye: Number(f.montant_paye) || 0,
        date_emission: f.date_emission,
        objet: f.objet,
        pourcentage_acompte: f.pourcentage_acompte ? Number(f.pourcentage_acompte) : null,
      })),
      avoirs: cmdAvoirs.map((a) => ({
        id: a.id,
        numero_affichage: a.numero_affichage,
        statut: a.statut,
        total_ttc: Number(a.total_ttc) || 0,
        date_emission: a.date_emission,
        motif: a.motif,
      })),
      totaux: {
        budget,
        totalDevis: Math.round(totalDevis * 100) / 100,
        totalFacture: Math.round(totalFacture * 100) / 100,
        totalPaye: Math.round(totalPaye * 100) / 100,
        totalAvoir: Math.round(totalAvoir * 100) / 100,
        resteAFacturer: Math.round((budget - totalFacture) * 100) / 100,
        resteAPayer: Math.round((totalFacture - totalPaye - totalAvoir) * 100) / 100,
      },
    };
  });

  // Session-level totals
  const sessionTotaux = {
    budget: pipelines.reduce((sum, p) => sum + p.totaux.budget, 0),
    totalFacture: pipelines.reduce((sum, p) => sum + p.totaux.totalFacture, 0),
    totalPaye: pipelines.reduce((sum, p) => sum + p.totaux.totalPaye, 0),
    totalAvoir: pipelines.reduce((sum, p) => sum + p.totaux.totalAvoir, 0),
  };

  return {
    data: {
      sessionId,
      commanditaires: pipelines,
      totaux: sessionTotaux,
    },
  };
}
