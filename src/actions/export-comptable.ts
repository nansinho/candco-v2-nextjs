"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import type { FECEntry } from "@/lib/fec-utils";

export async function getExportComptableData(
  dateDebut: string,
  dateFin: string,
): Promise<{ data: FECEntry[]; error?: string }> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: [], error: result.error };
  const { supabase } = result;

  // Fetch factures in the date range
  const { data: factures, error: fErr } = await supabase
    .from("factures")
    .select(
      `id, numero_affichage, date_emission, objet, total_ht, total_tva, total_ttc,
       entreprises(nom, numero_compte_comptable),
       facture_lignes(designation, montant_ht, taux_tva),
       facture_paiements(date_paiement, montant, mode, reference)`,
    )
    .gte("date_emission", dateDebut)
    .lte("date_emission", dateFin)
    .neq("statut", "brouillon")
    .is("archived_at", null)
    .order("date_emission");

  if (fErr) return { data: [], error: fErr.message };

  // Fetch avoirs in the date range
  const { data: avoirs, error: aErr } = await supabase
    .from("avoirs")
    .select(
      `id, numero_affichage, date_emission, motif, total_ht, total_tva, total_ttc,
       entreprises(nom, numero_compte_comptable)`,
    )
    .gte("date_emission", dateDebut)
    .lte("date_emission", dateFin)
    .neq("statut", "brouillon")
    .is("archived_at", null)
    .order("date_emission");

  if (aErr) return { data: [], error: aErr.message };

  const entries: FECEntry[] = [];
  let ecritureNum = 1;

  // Process factures
  for (const f of factures ?? []) {
    const entreprise = f.entreprises as unknown as { nom: string; numero_compte_comptable: string } | null;
    const compteClient = entreprise?.numero_compte_comptable || "411000";
    const nomClient = entreprise?.nom || "Client divers";
    const dateFormatted = formatFECDate(f.date_emission);
    const numStr = String(ecritureNum).padStart(6, "0");

    // Debit: client account (TTC)
    entries.push({
      JournalCode: "VE",
      JournalLib: "Journal des ventes",
      EcritureNum: numStr,
      EcritureDate: dateFormatted,
      CompteNum: compteClient,
      CompteLib: nomClient,
      CompAuxNum: compteClient,
      CompAuxLib: nomClient,
      PieceRef: f.numero_affichage || "",
      PieceDate: dateFormatted,
      EcritureLib: f.objet || `Facture ${f.numero_affichage}`,
      Debit: formatFECAmount(Number(f.total_ttc) || 0),
      Credit: "0,00",
      EcrtureLet: "",
      DateLet: "",
      ValidDate: dateFormatted,
      Montantdevise: "",
      Idevise: "EUR",
    });

    // Credit: revenue account (HT)
    entries.push({
      JournalCode: "VE",
      JournalLib: "Journal des ventes",
      EcritureNum: numStr,
      EcritureDate: dateFormatted,
      CompteNum: "706000",
      CompteLib: "Prestations de services",
      CompAuxNum: "",
      CompAuxLib: "",
      PieceRef: f.numero_affichage || "",
      PieceDate: dateFormatted,
      EcritureLib: f.objet || `Facture ${f.numero_affichage}`,
      Debit: "0,00",
      Credit: formatFECAmount(Number(f.total_ht) || 0),
      EcrtureLet: "",
      DateLet: "",
      ValidDate: dateFormatted,
      Montantdevise: "",
      Idevise: "EUR",
    });

    // Credit: TVA account (if TVA > 0)
    const tva = Number(f.total_tva) || 0;
    if (tva > 0) {
      entries.push({
        JournalCode: "VE",
        JournalLib: "Journal des ventes",
        EcritureNum: numStr,
        EcritureDate: dateFormatted,
        CompteNum: "445710",
        CompteLib: "TVA collectée",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: f.numero_affichage || "",
        PieceDate: dateFormatted,
        EcritureLib: `TVA ${f.numero_affichage}`,
        Debit: "0,00",
        Credit: formatFECAmount(tva),
        EcrtureLet: "",
        DateLet: "",
        ValidDate: dateFormatted,
        Montantdevise: "",
        Idevise: "EUR",
      });
    }

    // Payment entries
    const paiements = (f.facture_paiements ?? []) as {
      date_paiement: string;
      montant: number;
      mode: string;
      reference: string;
    }[];
    for (const p of paiements) {
      ecritureNum++;
      const pNum = String(ecritureNum).padStart(6, "0");
      const pDate = formatFECDate(p.date_paiement);

      entries.push({
        JournalCode: "BQ",
        JournalLib: "Journal de banque",
        EcritureNum: pNum,
        EcritureDate: pDate,
        CompteNum: "512000",
        CompteLib: "Banque",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: p.reference || f.numero_affichage || "",
        PieceDate: pDate,
        EcritureLib: `Règlement ${f.numero_affichage} ${p.mode || ""}`.trim(),
        Debit: formatFECAmount(Number(p.montant) || 0),
        Credit: "0,00",
        EcrtureLet: "",
        DateLet: "",
        ValidDate: pDate,
        Montantdevise: "",
        Idevise: "EUR",
      });

      entries.push({
        JournalCode: "BQ",
        JournalLib: "Journal de banque",
        EcritureNum: pNum,
        EcritureDate: pDate,
        CompteNum: compteClient,
        CompteLib: nomClient,
        CompAuxNum: compteClient,
        CompAuxLib: nomClient,
        PieceRef: p.reference || f.numero_affichage || "",
        PieceDate: pDate,
        EcritureLib: `Règlement ${f.numero_affichage} ${p.mode || ""}`.trim(),
        Debit: "0,00",
        Credit: formatFECAmount(Number(p.montant) || 0),
        EcrtureLet: "",
        DateLet: "",
        ValidDate: pDate,
        Montantdevise: "",
        Idevise: "EUR",
      });
    }

    ecritureNum++;
  }

  // Process avoirs (credit notes - reverse entries)
  for (const a of avoirs ?? []) {
    const entreprise = a.entreprises as unknown as { nom: string; numero_compte_comptable: string } | null;
    const compteClient = entreprise?.numero_compte_comptable || "411000";
    const nomClient = entreprise?.nom || "Client divers";
    const dateFormatted = formatFECDate(a.date_emission);
    const numStr = String(ecritureNum).padStart(6, "0");

    // Credit: client account (TTC) - reverse of facture
    entries.push({
      JournalCode: "VE",
      JournalLib: "Journal des ventes",
      EcritureNum: numStr,
      EcritureDate: dateFormatted,
      CompteNum: compteClient,
      CompteLib: nomClient,
      CompAuxNum: compteClient,
      CompAuxLib: nomClient,
      PieceRef: a.numero_affichage || "",
      PieceDate: dateFormatted,
      EcritureLib: a.motif || `Avoir ${a.numero_affichage}`,
      Debit: "0,00",
      Credit: formatFECAmount(Number(a.total_ttc) || 0),
      EcrtureLet: "",
      DateLet: "",
      ValidDate: dateFormatted,
      Montantdevise: "",
      Idevise: "EUR",
    });

    // Debit: revenue account (HT)
    entries.push({
      JournalCode: "VE",
      JournalLib: "Journal des ventes",
      EcritureNum: numStr,
      EcritureDate: dateFormatted,
      CompteNum: "706000",
      CompteLib: "Prestations de services",
      CompAuxNum: "",
      CompAuxLib: "",
      PieceRef: a.numero_affichage || "",
      PieceDate: dateFormatted,
      EcritureLib: a.motif || `Avoir ${a.numero_affichage}`,
      Debit: formatFECAmount(Number(a.total_ht) || 0),
      Credit: "0,00",
      EcrtureLet: "",
      DateLet: "",
      ValidDate: dateFormatted,
      Montantdevise: "",
      Idevise: "EUR",
    });

    ecritureNum++;
  }

  return { data: entries };
}

// ─── Helpers ─────────────────────────────────────────────

function formatFECDate(dateStr: string): string {
  // FEC format: YYYYMMDD
  return dateStr.replace(/-/g, "");
}

function formatFECAmount(amount: number): string {
  // FEC format: French decimal (comma)
  return amount.toFixed(2).replace(".", ",");
}

