import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { PDFParse } from "pdf-parse";
import { getOrganisationId } from "@/lib/auth-helpers";

export const maxDuration = 60;

const SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de programmes de formation professionnelle.
À partir du texte extrait d'un document PDF, tu dois identifier et structurer le programme de formation.

Tu dois retourner un JSON valide avec la structure suivante :
{
  "intitule": "Titre de la formation (si identifié)",
  "description": "Description générale de la formation (si identifiée)",
  "duree_heures": nombre ou null,
  "duree_jours": nombre ou null,
  "modules": [
    {
      "titre": "Titre du module/section",
      "contenu": "Contenu détaillé du module",
      "duree": "Durée du module (ex: 2h, 1 jour)"
    }
  ],
  "objectifs": ["Objectif pédagogique 1", "Objectif pédagogique 2"]
}

Règles :
- Extrais tous les modules/sections du programme dans l'ordre
- Si le document contient des objectifs pédagogiques, extrais-les
- Si des durées sont mentionnées, inclus-les
- Le contenu de chaque module doit être un résumé clair et concis
- Retourne UNIQUEMENT le JSON, sans texte autour
- Si le document n'est pas un programme de formation, retourne un JSON avec modules vide et un message dans description`;

export async function POST(request: NextRequest) {
  // Auth check
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY non configurée. Ajoutez-la dans vos variables d'environnement." },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
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

    // Truncate to ~30k chars to stay within token limits
    const truncatedText = text.slice(0, 30000);

    // Call Claude to structure the programme
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Voici le texte extrait du PDF d'un programme de formation. Analyse-le et retourne le JSON structuré :\n\n---\n${truncatedText}\n---`,
        },
      ],
    });

    // Extract text response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "L'IA n'a pas pu structurer le programme. Réessayez avec un autre document." },
        { status: 422 }
      );
    }

    const structured = JSON.parse(jsonMatch[0]);

    return NextResponse.json({ data: structured });
  } catch (error) {
    console.error("Extract programme error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
