// AI Provider — Anthropic Claude (C&CO pays) + per-org credit system
// Credits are tracked in organisations.settings.ai_credits

// ─── Credit costs ────────────────────────────────────────
export const AI_COSTS = {
  extract_programme: 1,
  extract_questionnaire: 1,
  generate_questionnaire: 1,
} as const;

export type AIAction = keyof typeof AI_COSTS;

export const DEFAULT_MONTHLY_CREDITS = 50;

// ─── Credit tracking (stored in organisations.settings) ──
export interface AICredits {
  monthly_limit: number;
  used: number;
  reset_month: string; // "2026-02" format
}

export const DEFAULT_AI_CREDITS: AICredits = {
  monthly_limit: DEFAULT_MONTHLY_CREDITS,
  used: 0,
  reset_month: getCurrentMonth(),
};

export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function getCreditsFromSettings(
  settings: Record<string, unknown> | null
): AICredits {
  const raw = (settings ?? {}) as Record<string, unknown>;
  const credits = (raw.ai_credits ?? {}) as Partial<AICredits>;
  const currentMonth = getCurrentMonth();

  // Auto-reset if we're in a new month
  if (credits.reset_month !== currentMonth) {
    return {
      monthly_limit: credits.monthly_limit ?? DEFAULT_MONTHLY_CREDITS,
      used: 0,
      reset_month: currentMonth,
    };
  }

  return {
    monthly_limit: credits.monthly_limit ?? DEFAULT_MONTHLY_CREDITS,
    used: credits.used ?? 0,
    reset_month: currentMonth,
  };
}

export function hasEnoughCredits(credits: AICredits, action: AIAction): boolean {
  return credits.used + AI_COSTS[action] <= credits.monthly_limit;
}

export function creditsRemaining(credits: AICredits): number {
  return Math.max(0, credits.monthly_limit - credits.used);
}

// ─── Claude API call ─────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentBlock[];
}

interface ChatCompletionResult {
  text: string;
}

export async function callClaude(
  messages: ChatMessage[],
  model = "claude-haiku-4-5-20251001"
): Promise<ChatCompletionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY non configuree sur le serveur");
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      ...(systemMsg ? { system: typeof systemMsg.content === "string" ? systemMsg.content : "" } : {}),
      messages: userMessages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Erreur Claude API (${response.status}): ${errorText.slice(0, 200)}`
    );
  }

  const data = await response.json();
  const content = (data as { content: { type: string; text: string }[] })
    .content;
  const textBlocks =
    content?.filter((b: { type: string }) => b.type === "text") ?? [];
  return { text: textBlocks.map((b: { text: string }) => b.text).join("") };
}

// ─── Credit update helper (for use in API routes) ────────

import { createAdminClient } from "@/lib/supabase/admin";

export async function deductCredits(
  organisationId: string,
  action: AIAction
): Promise<void> {
  const admin = createAdminClient();

  // Get current settings
  const { data: org } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
  const credits = getCreditsFromSettings(currentSettings);

  // Deduct credits
  const updatedCredits: AICredits = {
    ...credits,
    used: credits.used + AI_COSTS[action],
  };

  const newSettings = {
    ...currentSettings,
    ai_credits: updatedCredits,
  };

  await admin
    .from("organisations")
    .update({
      settings: newSettings,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organisationId);
}

export async function checkCredits(
  organisationId: string,
  action: AIAction
): Promise<{ ok: boolean; credits: AICredits }> {
  const admin = createAdminClient();

  const { data: org } = await admin
    .from("organisations")
    .select("settings")
    .eq("id", organisationId)
    .single();

  const currentSettings = (org?.settings ?? {}) as Record<string, unknown>;
  const storedCredits = (currentSettings.ai_credits ?? {}) as Partial<AICredits>;
  const credits = getCreditsFromSettings(currentSettings);

  // If month changed, persist the auto-reset
  if (storedCredits.reset_month !== getCurrentMonth()) {
    const newSettings = {
      ...currentSettings,
      ai_credits: credits,
    };
    await admin
      .from("organisations")
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organisationId);
  }

  return {
    ok: hasEnoughCredits(credits, action),
    credits,
  };
}
