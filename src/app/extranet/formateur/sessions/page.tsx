import { getExtranetUserContext, getFormateurSessions } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FormateurSessionsList } from "./sessions-list";

export default async function FormateurSessionsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  const { sessions } = await getFormateurSessions(ctx.entiteId);
  return <FormateurSessionsList sessions={sessions} />;
}
