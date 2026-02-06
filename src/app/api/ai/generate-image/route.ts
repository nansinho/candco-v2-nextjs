import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY non configurée. Ajoutez-la dans vos variables d'environnement." },
      { status: 500 }
    );
  }

  try {
    const { prompt, produitId } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Un prompt est requis" }, { status: 400 });
    }

    if (!produitId || typeof produitId !== "string") {
      return NextResponse.json({ error: "L'ID du produit est requis" }, { status: 400 });
    }

    // Build a prompt optimized for training/education imagery
    const fullPrompt = `Professional, modern, clean illustration for a training course: "${prompt}". Style: corporate illustration, flat design, soft gradients, minimalist, suitable for a professional training catalog. No text in the image. High quality, 16:9 aspect ratio.`;

    // Call OpenAI DALL-E API
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: fullPrompt,
        n: 1,
        size: "1792x1024",
        quality: "standard",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = (errorData as { error?: { message?: string } })?.error?.message || "Erreur lors de la génération de l'image";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    const b64Image = (data as { data: { b64_json: string }[] }).data[0]?.b64_json;

    if (!b64Image) {
      return NextResponse.json({ error: "Aucune image générée" }, { status: 500 });
    }

    // Upload to Supabase Storage
    const supabase = await createClient();
    const buffer = Buffer.from(b64Image, "base64");
    const filename = `produits/${produitId}/${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filename, buffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Upload échoué: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("images")
      .getPublicUrl(filename);

    // Update the product with the image URL
    const { error: updateError } = await supabase
      .from("produits_formation")
      .update({ image_url: urlData.publicUrl })
      .eq("id", produitId);

    if (updateError) {
      return NextResponse.json(
        { error: `Mise à jour produit échouée: ${updateError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { image_url: urlData.publicUrl } });
  } catch (error) {
    console.error("Generate image error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
