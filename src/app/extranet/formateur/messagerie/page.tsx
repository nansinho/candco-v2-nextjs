import { getExtranetUserContext } from "@/actions/extranet-context";
import { getMyConversations } from "@/actions/messagerie";
import { redirect } from "next/navigation";
import { MessagerieView } from "@/components/chat/MessagerieView";

export default async function FormateurMessageriePage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  const { data: conversations } = await getMyConversations();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Messagerie</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Échangez avec l&apos;administration et les apprenants
        </p>
      </div>
      <MessagerieView
        conversations={conversations}
        currentUserId={ctx.userId}
        canCreateSupport
      />
    </div>
  );
}
