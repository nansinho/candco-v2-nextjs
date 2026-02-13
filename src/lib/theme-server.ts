"use server";

import { getOrganisationId } from "@/lib/auth-helpers";

const DEFAULTS = { darkPresetId: "cursor", lightPresetId: "clean" } as const;

export async function getOrgThemePresets(): Promise<{
  darkPresetId: string;
  lightPresetId: string;
}> {
  try {
    const result = await getOrganisationId();
    if ("error" in result) return DEFAULTS;

    const { organisationId, admin } = result;

    const { data, error } = await admin
      .from("organisations")
      .select("theme_dark_preset, theme_light_preset")
      .eq("id", organisationId)
      .single();

    if (error || !data) return DEFAULTS;

    return {
      darkPresetId: data.theme_dark_preset || "cursor",
      lightPresetId: data.theme_light_preset || "clean",
    };
  } catch {
    return DEFAULTS;
  }
}
