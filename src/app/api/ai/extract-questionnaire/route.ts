import { NextRequest, NextResponse } from "next/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { callClaude, checkCredits, deductCredits } from "@/lib/ai-providers";

export const maxDuration = 120;

const SYSTEM_PROMPT = `Tu es un assistant specialise dans l'analyse de questionnaires et enquetes de satisfaction pour organismes de formation professionnelle francais.

A partir du document PDF fourni, tu dois identifier et structurer TOUTES les questions presentes dans le document.

Tu dois retourner un JSON valide avec la structure suivante :
{
  "nom": "Titre du questionnaire (extrait du document ou genere depuis le contexte)",
  "type": "satisfaction_chaud" ou "satisfaction_froid" ou "pedagogique_pre" ou "pedagogique_post" ou "standalone",
  "public_cible": "apprenant" ou "contact_client" ou "financeur" ou "formateur" ou null,
  "introduction": "Texte d'introduction si present dans le document" ou null,
  "questions": [
    {
      "texte": "Texte exact de la question",
      "type": "echelle" ou "choix_unique" ou "choix_multiple" ou "libre" ou "vrai_faux",
      "options": [
        {"label": "Option affichee", "value": "valeur_technique"}
      ],
      "obligatoire": true,
      "points": 0
    }
  ]
}

=== REGLES POUR DETECTER LE TYPE DE QUESTION ===

1. **echelle** : Questions avec notation numerique (0-10, 1-5, etoiles, etc.)
   - Ex: "Notez de 0 a 10 la qualite de la formation" → type: "echelle"
   - Ex: "Sur une echelle de 1 a 5..." → type: "echelle"
   - Pour les echelles, NE PAS mettre d'options — le front gere le slider 0-10

2. **choix_unique** : Questions avec une seule reponse possible parmi des choix
   - Ex: "Recommanderiez-vous cette formation ? Oui / Non / Peut-etre" → type: "choix_unique"
   - Ex: Cases a cocher ronds ou "cochez UNE reponse"
   - Mettre les choix dans "options" avec label et value

3. **choix_multiple** : Questions avec plusieurs reponses possibles
   - Ex: "Quels aspects avez-vous apprecies ? (plusieurs reponses possibles)"
   - Ex: Cases a cocher carrees ou "cochez tout ce qui s'applique"
   - Mettre les choix dans "options" avec label et value

4. **libre** : Questions ouvertes avec reponse texte
   - Ex: "Commentaires et suggestions :" → type: "libre"
   - Ex: "Qu'avez-vous le plus apprecie ?" sans choix → type: "libre"
   - Ne PAS mettre d'options pour le type "libre"

5. **vrai_faux** : Questions binaires vrai/faux
   - Ex: "Le contenu correspondait a vos attentes : Vrai / Faux"
   - Ne PAS mettre d'options — le front les genere

=== REGLES POUR LES OPTIONS ===

- Le "value" doit etre un slug en snake_case sans accents (ex: "tres_satisfait", "satisfait", "peu_satisfait")
- Le "label" doit etre le texte exact tel qu'il apparait dans le PDF
- Pour choix_unique et choix_multiple UNIQUEMENT
- Pour echelle, libre, vrai_faux : options doit etre un tableau vide []

=== REGLES GENERALES ===

- Extrais TOUTES les questions du document, dans l'ordre exact
- Si le document contient des sections/categories, utilise-les pour organiser mais met toutes les questions dans le meme tableau
- Detecte le type du questionnaire automatiquement :
  - Mots cles "satisfaction", "avis", "evaluation a chaud" → satisfaction_chaud
  - "a froid", "3 mois apres", "suivi post-formation" → satisfaction_froid
  - "positionnement", "avant la formation", "pre-formation" → pedagogique_pre
  - "evaluation des acquis", "post-formation", "apres la formation" → pedagogique_post
  - Sinon → standalone
- Detecte le public cible :
  - Destine aux stagiaires/apprenants → "apprenant"
  - Destine aux entreprises/commanditaires → "contact_client"
  - Destine aux formateurs → "formateur"
  - Sinon → null
- Par defaut, toutes les questions sont obligatoires sauf indication contraire
- Points = 0 par defaut (sauf si le document indique un bareme)
- Retourne UNIQUEMENT le JSON valide, sans texte ni markdown autour`;

export async function POST(request: NextRequest) {
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { organisationId } = authResult;

  const { ok, credits } = await checkCredits(organisationId, "extract_questionnaire");
  if (!ok) {
    return NextResponse.json(
      {
        error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci.`,
      },
      { status: 429 },
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

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const result = await callClaude([
      { role: "system", content: SYSTEM_PROMPT },
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
            text: "Analyse ce document et extrait TOUTES les questions pour construire un questionnaire complet. Retourne le JSON structure.",
          },
        ],
      },
    ]);

    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu extraire les questions du document. Reessayez avec un autre fichier." },
        { status: 422 },
      );
    }

    const structured = JSON.parse(jsonMatch[0]);

    await deductCredits(organisationId, "extract_questionnaire");

    return NextResponse.json({ data: structured });
  } catch (error) {
    console.error("Extract questionnaire error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
