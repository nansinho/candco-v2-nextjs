import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { getOrganisationId } from "@/lib/auth-helpers";
import { callClaude, checkCredits, deductCredits } from "@/lib/ai-providers";

export const maxDuration = 120;

const SYSTEM_PROMPT = `Tu es un assistant specialise dans l'analyse de programmes de formation professionnelle.
A partir du texte extrait d'un document PDF, tu dois identifier et structurer le programme de formation.

Tu dois retourner un JSON valide avec la structure suivante :
{
  "intitule": "Titre de la formation (si identifie)",
  "description": "Description generale de la formation (si identifiee)",
  "duree_heures": nombre ou null,
  "duree_jours": nombre ou null,
  "modules": [
    {
      "titre": "Titre du module/section",
      "contenu": "Contenu detaille du module",
      "duree": "Duree du module (ex: 2h, 1 jour)"
    }
  ],
  "objectifs": ["Objectif pedagogique 1", "Objectif pedagogique 2"]
}

Regles :
- Extrais tous les modules/sections du programme dans l'ordre
- Si le document contient des objectifs pedagogiques, extrais-les
- Si des durees sont mentionnees, inclus-les
- Le contenu de chaque module doit etre un resume clair et concis
- Retourne UNIQUEMENT le JSON, sans texte autour
- Si le document n'est pas un programme de formation, retourne un JSON avec modules vide et un message dans description`;

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
        error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci. L'extraction de programme coute 1 credit.`,
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

    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfParser = new PDFParse({ data: new Uint8Array(arrayBuffer) });
    const textResult = await pdfParser.getText();
    const text = textResult.text;

    if (!text || text.trim().length < 50) {
      return NextResponse.json(
        { error: "Le PDF ne contient pas assez de texte exploitable. Essayez un autre document." },
        { status: 400 }
      );
    }

    // Call Claude API
    const truncatedText = text.slice(0, 30000);
    const result = await callClaude([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Voici le texte extrait du PDF d'un programme de formation. Analyse-le et retourne le JSON structure :\n\n---\n${truncatedText}\n---`,
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
