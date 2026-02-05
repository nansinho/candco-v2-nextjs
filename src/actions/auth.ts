"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
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
