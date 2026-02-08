import { NextRequest, NextResponse } from "next/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { callClaude, checkCredits, deductCredits } from "@/lib/ai-providers";

export const maxDuration = 120;

const SYSTEM_PROMPT = `Tu es un assistant specialise dans l'analyse de programmes de formation professionnelle francais.
A partir du document PDF fourni, tu dois identifier et structurer TOUTES les informations du programme de formation.
Tu dois extraire LE MAXIMUM de donnees possible. Chaque champ rempli est important.

Tu dois retourner un JSON valide avec la structure suivante :
{
  "intitule": "Titre de la formation",
  "sous_titre": "Sous-titre (si present)" ou null,
  "description": "Description generale de la formation (courte, 2-3 phrases)",
  "domaine": "Domaine ou pole (ex: Sante, Securite, Management, Developpement web, etc.)" ou null,
  "categorie": "Sous-categorie du domaine (ex: Pratiques cliniques et techniques, Prevention des risques)" ou null,
  "type_action": "action_formation" ou "bilan_competences" ou "vae" ou "apprentissage" ou null,
  "modalite": "presentiel" ou "distanciel" ou "mixte" ou "afest" ou null,
  "formule": "inter" ou "intra" ou "individuel" ou null,
  "duree_heures": nombre ou null,
  "duree_jours": nombre ou null,
  "objectifs": ["Objectif 1", "Objectif 2", ...],
  "competences": ["Competence visee 1", "Competence visee 2", ...],
  "public_vise": ["Profil public 1 (ex: Pedicures-Podologues)", "Profil public 2", ...],
  "prerequis": ["Prerequis 1 (ex: Etre titulaire du diplome de...)", "Prerequis 2", ...],
  "nombre_participants_min": nombre ou null,
  "nombre_participants_max": nombre ou null,
  "certification": "Certification delivree (ex: Certificat de realisation, Attestation de fin de formation)" ou null,
  "delai_acces": "Delai d'acces (ex: Inscription jusqu'au matin de la formation)" ou null,
  "lieu_format": "Format et lieu (ex: Presentiel, Sur site (hotel ou salle de formation equipee))" ou null,
  "tarif_inter_ht": nombre ou null,
  "tarif_intra_ht": nombre ou null,
  "modules": [
    {
      "titre": "Titre du module/section/sequence",
      "contenu": "Contenu detaille du module avec TOUT le texte disponible. Inclure les sous-points, les details, les exemples. Ne pas resumer, garder le maximum de details.",
      "duree": "Duree du module (ex: 2h, 1 jour)" ou null
    }
  ],
  "modalites_evaluation": "Comment les acquis sont evalues (ex: Evaluation des acquis par questionnaire, exercices pratiques, mise en situation)" ou null,
  "modalites_pedagogiques": "Methodes pedagogiques utilisees (ex: Cours magistral, exercices pratiques, etudes de cas, travaux de groupe, mise en situation)" ou null,
  "moyens_pedagogiques": "Moyens mis a disposition (ex: Supports de cours, materiel de pratique, salle equipee, videoprojection)" ou null,
  "accessibilite": "Informations d'accessibilite handicap (ex: Formation accessible aux personnes en situation de handicap)" ou null,
  "financement": ["Mode de financement 1 (ex: Financement sur fonds propres)", "Mode 2 (ex: Financement possible par le FIF-PL)", ...],
  "modalites_paiement": "Conditions de paiement (ex: Paiement a reception de la facture)" ou null,
  "equipe_pedagogique": "Description de l'equipe pedagogique (ex: Formation animee par un formateur specialise en orthoplastie)" ou null
}

Regles STRICTES :
- Extrais le MAXIMUM d'informations du document. Chaque champ NULL est un champ manque.
- Si une information n'est pas presente dans le PDF, mets null (pas de chaine vide)
- Pour duree_heures et duree_jours, extrais les nombres. Ex: "14h (2 jours)" -> duree_heures: 14, duree_jours: 2
- Pour les tarifs, extrais le montant HT si possible. Si seul le TTC est donne, utilise-le quand meme.
- Les objectifs doivent etre une liste de chaines, un objectif par element
- Les competences visees sont differentes des objectifs : ce sont les capacites acquises a la fin
- public_vise est une LISTE de profils cibles (separe chaque profil en un element distinct)
- prerequis est une LISTE (separe chaque prerequis en un element distinct)
- financement est une LISTE de modes de financement possibles
- Les modules doivent etre dans l'ordre du document
- Le contenu de chaque module doit etre TRES detaille - inclure TOUT le texte du PDF pour ce module
- type_action, modalite, formule doivent correspondre EXACTEMENT aux valeurs listees ci-dessus
- Retourne UNIQUEMENT le JSON valide, sans texte ni markdown autour
- Si le document n'est pas un programme de formation, retourne quand meme un JSON avec ce que tu peux extraire
- En cas de doute sur un champ, mets la valeur la plus probable plutot que null`;

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
    const templateHints = formData.get("template_hints") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit etre un PDF" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Le fichier est trop volumineux (max 10 Mo)" }, { status: 400 });
    }

    // Build system prompt with optional template hints
    let systemPrompt = SYSTEM_PROMPT;
    if (templateHints) {
      try {
        const hints = JSON.parse(templateHints);
        if (hints.field_hints && Object.keys(hints.field_hints).length > 0) {
          systemPrompt += `\n\nINDICES SUPPLEMENTAIRES pour ce type de document :\n`;
          for (const [field, hint] of Object.entries(hints.field_hints)) {
            systemPrompt += `- ${field}: ${hint}\n`;
          }
        }
        if (hints.exemple_extraction) {
          systemPrompt += `\n\nEXEMPLE d'extraction reussie pour un document similaire :\n${JSON.stringify(hints.exemple_extraction, null, 2)}`;
        }
      } catch {
        // Ignore invalid template hints
      }
    }

    // Send PDF directly to Claude (native PDF support)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await callClaude([
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Analyse ce programme de formation et retourne le JSON complet avec TOUTES les informations que tu peux trouver. Ne laisse aucun champ vide si l'information est disponible dans le document.",
          },
        ],
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
