import { getExtranetUserContext, getFormateurProfile } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FormateurProfilForm } from "./profil-form";

export default async function FormateurProfilPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  const { data: formateur } = await getFormateurProfile(ctx.entiteId);
  if (!formateur) redirect("/login");

  return <FormateurProfilForm formateur={formateur} />;
}
