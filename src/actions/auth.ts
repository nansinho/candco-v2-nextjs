"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/emails/send-email";
import { magicLinkLoginTemplate } from "@/lib/emails/templates";
import { redirect } from "next/navigation";
import { z } from "zod";

const RegisterSchema = z.object({
  organisationNom: z.string().min(1, "Le nom de l'organisme est requis"),
  prenom: z.string().min(1, "Le prénom est requis"),
  nom: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Minimum 8 caractères"),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export async function register(input: RegisterInput) {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0];
    return { error: firstError?.[0] || "Données invalides" };
  }

  const { organisationNom, prenom, nom, email, password } = parsed.data;
  const admin = createAdminClient();

  // 1. Create auth user (skip email confirmation)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { prenom, nom, organisation_nom: organisationNom },
  });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      return { error: "Cet email est déjà utilisé" };
    }
    return { error: authError.message };
  }

  const userId = authData.user.id;

  // 2. Create organisation
  const { data: org, error: orgError } = await admin
    .from("organisations")
    .insert({ nom: organisationNom })
    .select("id")
    .single();

  if (orgError) {
    // Rollback: delete auth user
    await admin.auth.admin.deleteUser(userId);
    return { error: "Erreur lors de la création de l'organisme" };
  }

  // 3. Create utilisateur linked to org
  const { error: userError } = await admin
    .from("utilisateurs")
    .insert({
      id: userId,
      organisation_id: org.id,
      email,
      prenom,
      nom,
      role: "admin",
    });

  if (userError) {
    // Rollback
    await admin.from("organisations").delete().eq("id", org.id);
    await admin.auth.admin.deleteUser(userId);
    return { error: "Erreur lors de la création du profil" };
  }

  // 4. Sign in the user
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    return { error: "Compte créé mais erreur de connexion. Essayez de vous connecter." };
  }

  redirect("/");
}

// ─── Set password (first-time extranet users) ──────────

const SetPasswordSchema = z.object({
  password: z.string().min(8, "Minimum 8 caractères"),
  next: z.string().optional(),
});

export type SetPasswordInput = z.infer<typeof SetPasswordSchema>;

export async function setPassword(input: SetPasswordInput) {
  const parsed = SetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = Object.values(parsed.error.flatten().fieldErrors)[0];
    return { error: firstError?.[0] || "Données invalides" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Non authentifié" };
  }

  // Update the user's password
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: `Erreur : ${error.message}` };
  }

  // Activate extranet access if still "invite"
  const admin = createAdminClient();
  const { data: activatedAcces } = await admin
    .from("extranet_acces")
    .update({
      statut: "actif",
      active_le: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .in("statut", ["invite", "en_attente"])
    .select("role")
    .single();

  // Redirect to the correct extranet route, or fallback
  if (parsed.data.next) {
    redirect(parsed.data.next);
  }

  if (activatedAcces) {
    const routeMap: Record<string, string> = {
      formateur: "/extranet/formateur",
      apprenant: "/extranet/apprenant",
      contact_client: "/extranet/client",
    };
    redirect(routeMap[activatedAcces.role] || "/");
  }

  redirect("/");
}

// ─── Send magic link for login ──────────────────────────

export async function sendMagicLink(email: string) {
  const parsed = z.string().email().safeParse(email);
  if (!parsed.success) {
    return { error: "Email invalide" };
  }

  const admin = createAdminClient();

  // Generate magic link — will fail if user doesn't exist
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: parsed.data,
  });

  if (linkError) {
    // Don't reveal whether the email exists (prevent enumeration)
    return { success: true };
  }

  if (linkData?.properties?.hashed_token) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://solution.candco.fr";
    const loginLink = `${appUrl}/auth/callback?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=magiclink`;

    // Look up the user's organisation for email logging
    const userId = linkData.user?.id;
    let organisationId = "00000000-0000-0000-0000-000000000000";

    if (userId) {
      // Check utilisateurs first
      const { data: utilisateur } = await admin
        .from("utilisateurs")
        .select("organisation_id")
        .eq("id", userId)
        .single();

      if (utilisateur?.organisation_id) {
        organisationId = utilisateur.organisation_id;
      } else {
        // Check extranet_acces
        const { data: acces } = await admin
          .from("extranet_acces")
          .select("organisation_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (acces?.organisation_id) {
          organisationId = acces.organisation_id;
        }
      }
    }

    const html = magicLinkLoginTemplate({ lien: loginLink });

    await sendEmail({
      organisationId,
      to: parsed.data,
      subject: "C&CO Formation — Votre lien de connexion",
      html,
      template: "magic_link_login",
    }).catch((err) => {
      console.error("[auth] sendMagicLink sendEmail error:", err);
    });
  }

  // Always return success to prevent email enumeration
  return { success: true };
}
