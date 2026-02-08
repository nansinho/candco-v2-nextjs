import { NextRequest, NextResponse } from "next/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { callClaude, checkCredits, deductCredits } from "@/lib/ai-providers";

export const maxDuration = 120;

const SYSTEM_PROMPT = `Tu es un assistant specialise dans l'analyse de programmes de formation professionnelle francais.
A partir du texte extrait d'un document PDF, tu dois identifier et structurer TOUTES les informations du programme de formation.

Tu dois retourner un JSON valide avec la structure suivante :
{
  "intitule": "Titre de la formation",
  "sous_titre": "Sous-titre (si present)" ou null,
  "description": "Description generale de la formation",
  "domaine": "Domaine ou pole (ex: Securite, Developpement web, Management, etc.)" ou null,
  "type_action": "action_formation" ou "bilan_competences" ou "vae" ou "apprentissage" ou null,
  "modalite": "presentiel" ou "distanciel" ou "mixte" ou "afest" ou null,
  "formule": "inter" ou "intra" ou "individuel" ou null,
  "duree_heures": nombre ou null,
  "duree_jours": nombre ou null,
  "objectifs": ["Objectif 1", "Objectif 2", ...],
  "public_vise": "Description du public vise" ou null,
  "prerequis": "Prerequis (ex: Aucun prerequis)" ou null,
  "nombre_participants_min": nombre ou null,
  "nombre_participants_max": nombre ou null,
  "certification": "Certification delivree (si mentionnee)" ou null,
  "delai_acces": "Delai d'acces (ex: Inscription jusqu'au matin de la formation)" ou null,
  "lieu": "Lieu de la formation (si mentionne)" ou null,
  "tarif_inter_ht": nombre ou null,
  "tarif_intra_ht": nombre ou null,
  "modules": [
    {
      "titre": "Titre du module/section",
      "contenu": "Contenu detaille du module (en texte, pas de liste)",
      "duree": "Duree du module (ex: 2h, 1 jour)" ou null
    }
  ],
  "modalites_evaluation": "Comment les acquis sont evalues" ou null,
  "modalites_pedagogiques": "Methodes pedagogiques utilisees (ex: cours magistral, exercices pratiques...)" ou null,
  "moyens_pedagogiques": "Moyens mis a disposition (ex: supports de cours, materiel...)" ou null,
  "accessibilite": "Informations d'accessibilite handicap" ou null
}

Regles STRICTES :
- Extrais le MAXIMUM d'informations du document
- Si une information n'est pas presente dans le PDF, mets null (pas de chaine vide)
- Pour duree_heures et duree_jours, extrais les nombres. Ex: "14h (2 jours)" → duree_heures: 14, duree_jours: 2
- Pour les tarifs, extrais le montant HT si possible. Ex: "1440 euros HT" → tarif_intra_ht: 1440
- Les objectifs doivent etre une liste de chaines, un objectif par element
- Les modules doivent etre dans l'ordre du document
- Le contenu de chaque module doit etre detaille, pas un simple titre
- type_action, modalite, formule doivent correspondre EXACTEMENT aux valeurs listees ci-dessus
- Retourne UNIQUEMENT le JSON valide, sans texte ni markdown autour
- Si le document n'est pas un programme de formation, retourne quand meme un JSON avec ce que tu peux extraire`;

export async function POST(request: NextRequest) {
  // Auth check
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { organisationId } = authResult;

  // Check AI credits
  const { ok, credits } = await checkCredits(organisationId, "extract_programme");
  if (!ok) {
    return NextResponse.json(
      {
        error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci. L'extraction coute 1 credit.`,
      },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit etre un PDF" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Le fichier est trop volumineux (max 10 Mo)" }, { status: 400 });
    }

    // Extract text from PDF using pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule as unknown as { default: typeof pdfParseModule }).default ?? pdfParseModule;
    const pdfData = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(Buffer.from(arrayBuffer));
    const text = pdfData.text;

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Le PDF ne contient pas assez de texte exploitable. Essayez un autre document." },
        { status: 400 }
      );
    }

    // Call Claude API with comprehensive extraction prompt
    const truncatedText = text.slice(0, 30000);
    const result = await callClaude([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Voici le texte extrait du PDF d'un programme de formation. Analyse-le et retourne le JSON complet avec TOUTES les informations que tu peux trouver :\n\n---\n${truncatedText}\n---`,
      },
    ]);

    // Parse JSON from response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu structurer le programme. Reessayez avec un autre document." },
        { status: 422 }
      );
    }

    const structured = JSON.parse(jsonMatch[0]);

    // Deduct credits after successful call
    await deductCredits(organisationId, "extract_programme");

    return NextResponse.json({ data: structured });
  } catch (error) {
    console.error("Extract programme error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
