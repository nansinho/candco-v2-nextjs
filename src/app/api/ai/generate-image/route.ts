import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationId } from "@/lib/auth-helpers";
import { callDallE, checkCredits, deductCredits } from "@/lib/ai-providers";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Auth check
  const authResult = await getOrganisationId();
  if ("error" in authResult) {
    return NextResponse.json({ error: "Non authentifie" }, { status: 401 });
  }

  const { organisationId } = authResult;

  // Check AI credits
  const { ok, credits } = await checkCredits(organisationId, "generate_image");
  if (!ok) {
    return NextResponse.json(
      {
        error: `Credits IA insuffisants. ${credits.used}/${credits.monthly_limit} credits utilises ce mois-ci. La generation d'image coute 3 credits.`,
      },
      { status: 429 }
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

    // Call DALL-E with global API key
    const b64Image = await callDallE(fullPrompt);

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
        { error: `Upload echoue: ${uploadError.message}` },
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
      .eq("id", produitId)
      .eq("organisation_id", organisationId);

    if (updateError) {
      return NextResponse.json(
        { error: `Mise a jour produit echouee: ${updateError.message}` },
        { status: 500 }
      );
    }

    // Deduct credits after successful generation
    await deductCredits(organisationId, "generate_image");

    return NextResponse.json({ data: { image_url: urlData.publicUrl } });
  } catch (error) {
    console.error("Generate image error:", error);
    const message = error instanceof Error ? error.message : "Erreur interne";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
