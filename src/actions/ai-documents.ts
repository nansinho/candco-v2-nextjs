"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { requirePermission, canManageFinances, type UserRole } from "@/lib/permissions";
import { callClaude, checkCredits, deductCredits, type AIAction } from "@/lib/ai-providers";
import { createDevis, type CreateDevisInput } from "@/actions/devis";
import { createFacture, type CreateFactureInput } from "@/actions/factures";
import { revalidatePath } from "next/cache";

// ─── Types ──────────────────────────────────────────────

export type AIDocumentType = "devis" | "facture" | "convention";

interface AIDocumentResult {
  data?: { id: string; type: AIDocumentType; numero?: string };
  error?: string;
}

// ─── System Prompts ─────────────────────────────────────

function getDevisSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `Tu es un assistant specialise dans la creation de devis pour organismes de formation professionnelle francais.

A partir de la demande de l'utilisateur et des donnees disponibles, tu dois generer un devis structure au format JSON.

REGLES IMPORTANTES :
- Tu dois OBLIGATOIREMENT utiliser les IDs exacts des entites fournies dans les donnees (entreprises, contacts, produits). Ne les invente JAMAIS.
- Si l'utilisateur mentionne une entreprise, un contact ou un produit, cherche la correspondance la plus proche dans les donnees fournies.
- Si aucune correspondance n'est trouvee, laisse le champ vide ("").
- Pour les organismes de formation, la TVA est souvent exoneree (0%) sauf indication contraire (art. 261-4-4a du CGI).
- Si un produit de formation est mentionne, utilise ses tarifs pour calculer les prix des lignes.
- Si un nombre de participants est mentionne, utilise-le comme quantite.
- Les designations doivent etre professionnelles et detaillees.
- L'objet doit etre clair et descriptif.
- La date d'emission par defaut est aujourd'hui : ${today}
- La date d'echeance par defaut est 30 jours apres l'emission.
- Utilise les conditions et mentions legales par defaut de l'organisation si disponibles.
- Les montants doivent etre arrondis a 2 decimales.

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks, sans texte autour) avec cette structure exacte :
{
  "entreprise_id": "uuid ou vide",
  "contact_client_id": "uuid ou vide",
  "particulier_nom": "nom du particulier ou vide",
  "particulier_email": "email ou vide",
  "date_emission": "${today}",
  "date_echeance": "YYYY-MM-DD ou vide",
  "objet": "Objet du devis",
  "conditions": "Conditions de paiement",
  "mentions_legales": "Mentions legales",
  "lignes": [
    {
      "designation": "Description de la ligne",
      "description": "Details supplementaires ou vide",
      "quantite": 1,
      "prix_unitaire_ht": 0.00,
      "taux_tva": 0,
      "ordre": 0
    }
  ]
}`;
}

function getFactureSystemPrompt(): string {
  const today = new Date().toISOString().split("T")[0];
  return `Tu es un assistant specialise dans la creation de factures pour organismes de formation professionnelle francais.

A partir de la demande de l'utilisateur et des donnees disponibles, tu dois generer une facture structuree au format JSON.

REGLES IMPORTANTES :
- Tu dois OBLIGATOIREMENT utiliser les IDs exacts des entites fournies dans les donnees. Ne les invente JAMAIS.
- Pour les OF, la TVA est souvent exoneree (0%) sauf indication contraire.
- Utilise les tarifs des produits de formation si mentionnes.
- Les designations doivent etre professionnelles.
- La date d'emission par defaut est aujourd'hui : ${today}
- La date d'echeance par defaut est 30 jours apres.
- Les montants doivent etre arrondis a 2 decimales.

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) avec cette structure :
{
  "entreprise_id": "uuid ou vide",
  "contact_client_id": "uuid ou vide",
  "date_emission": "${today}",
  "date_echeance": "YYYY-MM-DD ou vide",
  "objet": "Objet de la facture",
  "conditions_paiement": "Conditions de paiement",
  "mentions_legales": "Mentions legales",
  "session_id": "uuid de la session ou vide",
  "lignes": [
    {
      "designation": "Description",
      "description": "Details ou vide",
      "quantite": 1,
      "prix_unitaire_ht": 0.00,
      "taux_tva": 0,
      "ordre": 0
    }
  ]
}`;
}

function getConventionSystemPrompt(): string {
  return `Tu es un assistant specialise dans la generation de conventions de formation pour organismes de formation professionnelle francais.

A partir de la demande de l'utilisateur et des donnees disponibles, tu dois identifier la session et le commanditaire pour lesquels generer la convention.

REGLES IMPORTANTES :
- Tu dois OBLIGATOIREMENT utiliser les IDs exacts fournis dans les donnees.
- Cherche la session et le commanditaire qui correspondent le mieux a la demande.
- Si plusieurs sessions ou commanditaires correspondent, choisis le plus probable.

Retourne UNIQUEMENT un JSON valide (sans markdown, sans backticks) avec cette structure :
{
  "session_id": "uuid de la session",
  "commanditaire_id": "uuid du commanditaire"
}`;
}

// ─── Context Fetching ───────────────────────────────────

interface DocumentContext {
  entreprises: Array<{
    id: string;
    nom: string;
    siret: string | null;
    email: string | null;
    adresse_rue: string | null;
    adresse_cp: string | null;
    adresse_ville: string | null;
  }>;
  contacts: Array<{
    id: string;
    prenom: string;
    nom: string;
    email: string | null;
    fonction: string | null;
  }>;
  produits: Array<{
    id: string;
    intitule: string;
    duree_heures: number | null;
    duree_jours: number | null;
    modalite: string | null;
    formule: string | null;
    produit_tarifs: Array<{
      id: string;
      nom: string | null;
      prix_ht: number;
      taux_tva: number;
      unite: string | null;
      is_default: boolean;
    }>;
  }>;
  articles: Array<{
    id: string;
    reference: string | null;
    designation: string;
    prix_unitaire_ht: number;
    taux_tva: number;
    unite: string | null;
  }>;
  orgSettings: {
    nom: string | null;
    siret: string | null;
    nda: string | null;
    mentions_legales: string | null;
    conditions_paiement: string | null;
    tva_defaut: number | null;
  } | null;
  sessions: Array<{
    id: string;
    nom: string;
    numero_affichage: string | null;
    date_debut: string | null;
    date_fin: string | null;
    session_commanditaires: Array<{
      id: string;
      entreprises: { id: string; nom: string } | null;
      contacts_clients: { id: string; prenom: string; nom: string } | null;
    }>;
    session_formateurs: Array<{
      formateurs: { prenom: string; nom: string } | null;
    }>;
  }> | null;
}

async function fetchDocumentContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  organisationId: string,
  documentType: AIDocumentType,
): Promise<DocumentContext> {
  const [entreprisesRes, contactsRes, produitsRes, articlesRes, orgRes] = await Promise.all([
    admin
      .from("entreprises")
      .select("id, nom, siret, email, adresse_rue, adresse_cp, adresse_ville")
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("nom")
      .limit(50),
    admin
      .from("contacts_clients")
      .select("id, prenom, nom, email, fonction")
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("nom")
      .limit(50),
    admin
      .from("produits_formation")
      .select("id, intitule, duree_heures, duree_jours, modalite, formule, produit_tarifs(id, nom, prix_ht, taux_tva, unite, is_default)")
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .order("intitule")
      .limit(50),
    admin
      .from("articles_catalogue")
      .select("id, reference, designation, prix_unitaire_ht, taux_tva, unite")
      .eq("organisation_id", organisationId)
      .eq("actif", true)
      .is("archived_at", null)
      .order("designation")
      .limit(50),
    admin
      .from("organisations")
      .select("nom, siret, nda, mentions_legales, conditions_paiement, tva_defaut")
      .eq("id", organisationId)
      .single(),
  ]);

  let sessions = null;
  if (documentType === "convention") {
    const sessResult = await admin
      .from("sessions")
      .select(`id, nom, numero_affichage, date_debut, date_fin,
        session_commanditaires(id, entreprises(id, nom), contacts_clients(id, prenom, nom)),
        session_formateurs(formateurs(prenom, nom))`)
      .eq("organisation_id", organisationId)
      .is("archived_at", null)
      .in("statut", ["en_projet", "validee", "en_cours"])
      .order("created_at", { ascending: false })
      .limit(30);
    sessions = sessResult.data;
  }

  return {
    entreprises: entreprisesRes.data ?? [],
    contacts: contactsRes.data ?? [],
    produits: produitsRes.data ?? [],
    articles: articlesRes.data ?? [],
    orgSettings: orgRes.data,
    sessions,
  };
}

// ─── Format Context for Prompt ──────────────────────────

function formatContextForPrompt(context: DocumentContext): string {
  let text = "=== DONNEES DISPONIBLES DANS LA BASE ===\n\n";

  text += "ENTREPRISES :\n";
  for (const e of context.entreprises) {
    text += `- id:"${e.id}" nom:"${e.nom}" siret:${e.siret || "?"} email:${e.email || "?"}\n`;
  }

  text += "\nCONTACTS CLIENTS :\n";
  for (const c of context.contacts) {
    text += `- id:"${c.id}" nom:"${c.prenom} ${c.nom}" email:${c.email || "?"} fonction:${c.fonction || "?"}\n`;
  }

  text += "\nPRODUITS DE FORMATION (avec tarifs) :\n";
  for (const p of context.produits) {
    const tarifs = (p.produit_tarifs || [])
      .map(
        (t) =>
          `${t.nom || "standard"}: ${t.prix_ht}€ HT/${t.unite || "forfait"} (TVA ${t.taux_tva}%)`,
      )
      .join(", ");
    text += `- id:"${p.id}" intitule:"${p.intitule}" duree:${p.duree_heures || "?"}h/${p.duree_jours || "?"}j modalite:${p.modalite || "?"} tarifs:[${tarifs}]\n`;
  }

  if (context.articles.length > 0) {
    text += "\nARTICLES CATALOGUE (lignes pre-definies) :\n";
    for (const a of context.articles) {
      text += `- ref:${a.reference || "?"} designation:"${a.designation}" prix:${a.prix_unitaire_ht}€ HT tva:${a.taux_tva}%\n`;
    }
  }

  if (context.sessions) {
    text += "\nSESSIONS EN COURS :\n";
    for (const s of context.sessions) {
      const cmds = (s.session_commanditaires || [])
        .map(
          (c) =>
            `cmd_id:"${c.id}" ent:"${c.entreprises?.nom || "?"}" contact:"${c.contacts_clients ? `${c.contacts_clients.prenom} ${c.contacts_clients.nom}` : "?"}"`,
        )
        .join("; ");
      const formateurs = (s.session_formateurs || [])
        .map((f) => (f.formateurs ? `${f.formateurs.prenom} ${f.formateurs.nom}` : "?"))
        .join(", ");
      text += `- id:"${s.id}" numero:"${s.numero_affichage}" nom:"${s.nom}" dates:${s.date_debut || "?"}→${s.date_fin || "?"} formateurs:[${formateurs}] commanditaires:[${cmds}]\n`;
    }
  }

  const org = context.orgSettings;
  if (org) {
    text += `\nINFOS ORGANISATION : ${org.nom || "?"}, SIRET: ${org.siret || "?"}, NDA: ${org.nda || "?"}\n`;
    text += `TVA par defaut : ${org.tva_defaut ?? 0}%\n`;
    if (org.conditions_paiement) text += `Conditions de paiement par defaut : ${org.conditions_paiement}\n`;
    if (org.mentions_legales) text += `Mentions legales par defaut : ${org.mentions_legales}\n`;
  }

  return text;
}

// ─── Create Document From AI Output ─────────────────────

async function createDevisFromAI(
  aiData: Record<string, unknown>,
): Promise<AIDocumentResult> {
  const today = new Date().toISOString().split("T")[0];
  const rawLignes = (aiData.lignes as Array<Record<string, unknown>>) || [];

  const input: CreateDevisInput = {
    entreprise_id: (aiData.entreprise_id as string) || "",
    contact_client_id: (aiData.contact_client_id as string) || "",
    particulier_nom: (aiData.particulier_nom as string) || "",
    particulier_email: (aiData.particulier_email as string) || "",
    particulier_telephone: "",
    particulier_adresse: "",
    date_emission: (aiData.date_emission as string) || today,
    date_echeance: (aiData.date_echeance as string) || "",
    objet: (aiData.objet as string) || "",
    conditions: (aiData.conditions as string) || "",
    mentions_legales: (aiData.mentions_legales as string) || "",
    statut: "brouillon",
    opportunite_id: "",
    session_id: (aiData.session_id as string) || "",
    commanditaire_id: "",
    lignes: rawLignes.map((l, i) => ({
      designation: (l.designation as string) || "Ligne",
      description: (l.description as string) || "",
      quantite: Number(l.quantite) || 1,
      prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
      taux_tva: Number(l.taux_tva) || 0,
      ordre: i,
    })),
  };

  const result = await createDevis(input);
  if (result.error) {
    const errMsg =
      typeof result.error === "object" && "_form" in result.error
        ? (result.error._form as string[]).join(", ")
        : String(result.error);
    return { error: errMsg };
  }
  return {
    data: {
      id: result.data!.id,
      type: "devis",
      numero: result.data!.numero_affichage,
    },
  };
}

async function createFactureFromAI(
  aiData: Record<string, unknown>,
): Promise<AIDocumentResult> {
  const today = new Date().toISOString().split("T")[0];
  const rawLignes = (aiData.lignes as Array<Record<string, unknown>>) || [];

  const input: CreateFactureInput = {
    entreprise_id: (aiData.entreprise_id as string) || "",
    contact_client_id: (aiData.contact_client_id as string) || "",
    date_emission: (aiData.date_emission as string) || today,
    date_echeance: (aiData.date_echeance as string) || "",
    objet: (aiData.objet as string) || "",
    conditions_paiement: (aiData.conditions_paiement as string) || "",
    mentions_legales: (aiData.mentions_legales as string) || "",
    statut: "brouillon",
    session_id: (aiData.session_id as string) || "",
    commanditaire_id: "",
    lignes: rawLignes.map((l, i) => ({
      designation: (l.designation as string) || "Ligne",
      description: (l.description as string) || "",
      quantite: Number(l.quantite) || 1,
      prix_unitaire_ht: Number(l.prix_unitaire_ht) || 0,
      taux_tva: Number(l.taux_tva) || 0,
      ordre: i,
    })),
  };

  const result = await createFacture(input);
  if (result.error) {
    const errMsg =
      typeof result.error === "object" && "_form" in result.error
        ? (result.error._form as string[]).join(", ")
        : String(result.error);
    return { error: errMsg };
  }
  return {
    data: {
      id: (result as { data: { id: string; numero_affichage: string } }).data.id,
      type: "facture",
      numero: (result as { data: { id: string; numero_affichage: string } }).data.numero_affichage,
    },
  };
}

async function createConventionFromAI(
  aiData: Record<string, unknown>,
): Promise<AIDocumentResult> {
  const sessionId = aiData.session_id as string;
  const commanditaireId = aiData.commanditaire_id as string;

  if (!sessionId || !commanditaireId) {
    return {
      error:
        "L'IA n'a pas pu identifier la session ou le commanditaire. Precisez votre demande.",
    };
  }

  const { generateSessionConvention } = await import("@/actions/documents");
  const result = await generateSessionConvention(sessionId, commanditaireId);

  if ("error" in result && result.error) {
    return { error: typeof result.error === "string" ? result.error : "Erreur generation convention" };
  }
  return { data: { id: sessionId, type: "convention" } };
}

// ─── Main Action ────────────────────────────────────────

export async function generateDocumentFromPrompt(
  prompt: string,
  documentType: AIDocumentType,
): Promise<AIDocumentResult> {
  if (!prompt || prompt.trim().length < 10) {
    return { error: "Le prompt doit contenir au moins 10 caracteres" };
  }

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };
  const { organisationId, role, admin } = result;

  requirePermission(
    role as UserRole,
    canManageFinances,
    `generer un ${documentType} par IA`,
  );

  // Map document type to AI action
  const actionMap: Record<AIDocumentType, AIAction> = {
    devis: "generate_devis",
    facture: "generate_facture",
    convention: "generate_convention",
  };
  const aiAction = actionMap[documentType];

  const { ok, credits } = await checkCredits(organisationId, aiAction);
  if (!ok) {
    return {
      error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci. La generation coute 2 credits.`,
    };
  }

  try {
    // 1. Fetch context data from DB
    const context = await fetchDocumentContext(admin, organisationId, documentType);
    const contextText = formatContextForPrompt(context);

    // 2. Select system prompt
    const systemPrompt =
      documentType === "devis"
        ? getDevisSystemPrompt()
        : documentType === "facture"
          ? getFactureSystemPrompt()
          : getConventionSystemPrompt();

    // 3. Call Claude
    const aiResult = await callClaude([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `${contextText}\n\n=== DEMANDE DE L'UTILISATEUR ===\n${prompt}`,
      },
    ]);

    // 4. Parse JSON response
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        error:
          "L'IA n'a pas pu generer le document. Reessayez avec un prompt plus precis.",
      };
    }

    let aiData: Record<string, unknown>;
    try {
      aiData = JSON.parse(jsonMatch[0]);
    } catch {
      return {
        error:
          "L'IA a retourne un format invalide. Reessayez avec un prompt plus precis.",
      };
    }

    // 5. Create the document
    let createdDoc: AIDocumentResult;
    if (documentType === "devis") {
      createdDoc = await createDevisFromAI(aiData);
    } else if (documentType === "facture") {
      createdDoc = await createFactureFromAI(aiData);
    } else {
      createdDoc = await createConventionFromAI(aiData);
    }

    if (createdDoc.error) return createdDoc;

    // 6. Deduct credits only after success
    await deductCredits(organisationId, aiAction);

    revalidatePath(`/${documentType === "convention" ? "sessions" : documentType + "s"}`);
    return createdDoc;
  } catch (error) {
    console.error(`AI generate ${documentType} error:`, error);
    return {
      error:
        error instanceof Error ? error.message : "Erreur lors de la generation",
    };
  }
}
