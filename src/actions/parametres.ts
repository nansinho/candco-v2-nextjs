"use server";

import { getOrganisationId } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────────

export interface OrganisationSettings {
  id: string;
  nom: string;
  siret: string | null;
  nda: string | null;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  logo_url: string | null;
  // Facturation
  mentions_legales: string | null;
  conditions_paiement: string | null;
  coordonnees_bancaires: string | null;
  tva_defaut: number | null;
  numero_tva_intracommunautaire: string | null;
  // Email
  email_expediteur: string | null;
  signature_email: string | null;
  // Style
  couleur_primaire: string | null;
  // Settings JSONB (AI credits, etc.)
  settings: Record<string, unknown> | null;
}

// ─── Schemas ────────────────────────────────────────────

const GeneralSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  siret: z.string().optional().or(z.literal("")),
  nda: z.string().optional().or(z.literal("")),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  adresse_rue: z.string().optional().or(z.literal("")),
  adresse_complement: z.string().optional().or(z.literal("")),
  adresse_cp: z.string().optional().or(z.literal("")),
  adresse_ville: z.string().optional().or(z.literal("")),
});

const FacturationSchema = z.object({
  mentions_legales: z.string().optional().or(z.literal("")),
  conditions_paiement: z.string().optional().or(z.literal("")),
  coordonnees_bancaires: z.string().optional().or(z.literal("")),
  tva_defaut: z.coerce.number().min(0).max(100).optional(),
  numero_tva_intracommunautaire: z.string().optional().or(z.literal("")),
});

const EmailSchema = z.object({
  email_expediteur: z.string().email("Email invalide").optional().or(z.literal("")),
  signature_email: z.string().optional().or(z.literal("")),
});

// ─── Get Settings ───────────────────────────────────────

const SETTINGS_FIELDS = `
  id, nom, siret, nda, email, telephone,
  adresse_rue, adresse_complement, adresse_cp, adresse_ville,
  logo_url,
  mentions_legales, conditions_paiement, coordonnees_bancaires,
  tva_defaut, numero_tva_intracommunautaire,
  email_expediteur, signature_email,
  couleur_primaire,
  settings
`;

export async function getOrganisationSettings(): Promise<{
  data: OrganisationSettings | null;
  error: string | null;
}> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null, error: result.error ?? "Erreur inconnue" };

  const { organisationId, admin } = result;

  const { data, error } = await admin
    .from("organisations")
    .select(SETTINGS_FIELDS)
    .eq("id", organisationId)
    .single();

  if (error) return { data: null, error: error.message };
  return { data: data as OrganisationSettings, error: null };
}

// ─── Update General ─────────────────────────────────────

export async function updateGeneralSettings(
  input: z.infer<typeof GeneralSchema>
) {
  const parsed = GeneralSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };

  const { organisationId, admin } = result;
  const d = parsed.data;

  const { error } = await admin
    .from("organisations")
    .update({
      nom: d.nom,
      siret: d.siret || null,
      nda: d.nda || null,
      email: d.email || null,
      telephone: d.telephone || null,
      adresse_rue: d.adresse_rue || null,
      adresse_complement: d.adresse_complement || null,
      adresse_cp: d.adresse_cp || null,
      adresse_ville: d.adresse_ville || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { success: true };
}

// ─── Update Facturation ─────────────────────────────────

export async function updateFacturationSettings(
  input: z.infer<typeof FacturationSchema>
) {
  const parsed = FacturationSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };

  const { organisationId, admin } = result;
  const d = parsed.data;

  const { error } = await admin
    .from("organisations")
    .update({
      mentions_legales: d.mentions_legales || null,
      conditions_paiement: d.conditions_paiement || null,
      coordonnees_bancaires: d.coordonnees_bancaires || null,
      tva_defaut: d.tva_defaut ?? 0,
      numero_tva_intracommunautaire: d.numero_tva_intracommunautaire || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/parametres");
  return { success: true };
}

// ─── Update Email Settings ──────────────────────────────

export async function updateEmailSettings(
  input: z.infer<typeof EmailSchema>
) {
  const parsed = EmailSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.flatten().fieldErrors };

  const result = await getOrganisationId();
  if ("error" in result) return { error: { _form: [result.error] } };

  const { organisationId, admin } = result;
  const d = parsed.data;

  const { error } = await admin
    .from("organisations")
    .update({
      email_expediteur: d.email_expediteur || null,
      signature_email: d.signature_email || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/parametres");
  return { success: true };
}

// ─── Upload Logo ────────────────────────────────────────

export async function uploadOrganisationLogo(formData: FormData) {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };

  const { organisationId, admin } = result;

  const file = formData.get("logo") as File | null;
  if (!file) return { error: "Aucun fichier sélectionné" };

  // Validate file
  if (!file.type.startsWith("image/"))
    return { error: "Le fichier doit être une image" };
  if (file.size > 2 * 1024 * 1024)
    return { error: "Le fichier ne doit pas dépasser 2 Mo" };

  const ext = file.name.split(".").pop() || "png";
  const filename = `logos/${organisationId}/${Date.now()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("images")
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) return { error: `Upload échoué: ${uploadError.message}` };

  const { data: urlData } = admin.storage
    .from("images")
    .getPublicUrl(filename);

  const logoUrl = urlData.publicUrl;

  // Update organisation
  const { error: updateError } = await admin
    .from("organisations")
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq("id", organisationId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { success: true, logoUrl };
}

// ─── Remove Logo ────────────────────────────────────────

export async function removeOrganisationLogo() {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };

  const { organisationId, admin } = result;

  const { error } = await admin
    .from("organisations")
    .update({ logo_url: null, updated_at: new Date().toISOString() })
    .eq("id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { success: true };
}

// ─── Theme Colors ──────────────────────────────────────

export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  sidebar: string;
  header: string;
  border: string;
  muted: string;
  accent: string;
  gradient_from?: string;
  gradient_to?: string;
}

export interface ThemeColors {
  dark: ThemePalette;
  light: ThemePalette;
}

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

const ThemeColorSchema = z.object({
  background: z.string().regex(hexColorRegex),
  foreground: z.string().regex(hexColorRegex),
  card: z.string().regex(hexColorRegex),
  primary: z.string().regex(hexColorRegex),
  sidebar: z.string().regex(hexColorRegex),
  header: z.string().regex(hexColorRegex),
  border: z.string().regex(hexColorRegex),
  muted: z.string().regex(hexColorRegex),
  accent: z.string().regex(hexColorRegex),
  gradient_from: z.string().regex(hexColorRegex).optional(),
  gradient_to: z.string().regex(hexColorRegex).optional(),
});

const ThemeColorsSchema = z.object({
  dark: ThemeColorSchema,
  light: ThemeColorSchema,
});

export async function updateThemeSettings(input: ThemeColors) {
  const parsed = ThemeColorsSchema.safeParse(input);
  if (!parsed.success) return { error: "Couleurs invalides" };

  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };

  const { organisationId, admin } = result;

  // Read existing settings JSONB to merge
  const { data: org } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  const existingSettings = (org?.settings ?? {}) as Record<string, unknown>;
  const newSettings = { ...existingSettings, theme_colors: parsed.data };

  const { error } = await admin
    .from("organisations")
    .update({
      settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function getThemeSettings(): Promise<{
  data: ThemeColors | null;
  error: string | null;
}> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null, error: result.error ?? "Erreur inconnue" };

  const { organisationId, admin } = result;

  const { data: org, error } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  if (error) return { data: null, error: error.message };

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const themeColors = settings.theme_colors as ThemeColors | undefined;

  return { data: themeColors ?? null, error: null };
}

export async function resetThemeSettings() {
  const result = await getOrganisationId();
  if ("error" in result) return { error: result.error };

  const { organisationId, admin } = result;

  const { data: org } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  const existingSettings = (org?.settings ?? {}) as Record<string, unknown>;
  delete existingSettings.theme_colors;

  const { error } = await admin
    .from("organisations")
    .update({
      settings: existingSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);

  if (error) return { error: error.message };

  revalidatePath("/parametres");
  revalidatePath("/", "layout");
  return { success: true };
}

// ─── Get AI Credits ─────────────────────────────────────

export async function getAICredits(): Promise<{
  data: { monthly_limit: number; used: number; remaining: number } | null;
  error: string | null;
}> {
  const result = await getOrganisationId();
  if ("error" in result) return { data: null, error: result.error ?? "Erreur inconnue" };

  const { organisationId, admin } = result;

  const { data: org, error } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  if (error) return { data: null, error: error.message };

  const { getCreditsFromSettings, creditsRemaining } = await import("@/lib/ai-providers");
  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  const credits = getCreditsFromSettings(settings);

  return {
    data: {
      monthly_limit: credits.monthly_limit,
      used: credits.used,
      remaining: creditsRemaining(credits),
    },
    error: null,
  };
}
