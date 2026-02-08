import { getExtranetUserContext, getFormateurSessions } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FormateurDashboard } from "./dashboard";

export default async function ExtranetFormateurPage() {
  const { data: ctx, error } = await getExtranetUserContext();

  if (error || !ctx || ctx.role !== "formateur") {
    redirect("/login");
  }

  const { sessions } = await getFormateurSessions(ctx.entiteId);

  return <FormateurDashboard context={ctx} sessions={sessions} />;
}
