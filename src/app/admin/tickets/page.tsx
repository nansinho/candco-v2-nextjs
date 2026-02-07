import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const statutColors: Record<string, string> = {
  ouvert: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  en_cours: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  resolu: "bg-green-500/10 text-green-500 border-green-500/20",
  ferme: "bg-muted text-muted-foreground border-border",
};

const statutLabels: Record<string, string> = {
  ouvert: "Ouvert",
  en_cours: "En cours",
  resolu: "Résolu",
  ferme: "Fermé",
};

export default async function AdminTicketsPage() {
  const admin = createAdminClient();

  // Get all tickets with org name
  const { data: tickets } = await admin
    .from("tickets")
    .select(
      "id, titre, description, statut, priorite, created_at, organisation_id, organisations(nom)"
    )
    .order("created_at", { ascending: false });

  const openTickets = tickets?.filter(
    (t) => t.statut === "ouvert" || t.statut === "en_cours"
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tickets — Tous les OF</h2>
        <p className="text-muted-foreground">
          {openTickets?.length || 0} ticket(s) ouvert(s) sur{" "}
          {tickets?.length || 0} au total
        </p>
      </div>

      <div className="grid gap-3">
        {tickets?.map((ticket) => {
          const org = ticket.organisations as unknown as { nom: string } | null;
          return (
            <Card key={ticket.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm font-medium">
                    {ticket.titre}
                  </CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs">
                      {org?.nom || "—"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={statutColors[ticket.statut] || ""}
                    >
                      {statutLabels[ticket.statut] || ticket.statut}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {ticket.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {ticket.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(ticket.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </CardContent>
              )}
            </Card>
          );
        })}

        {(!tickets || tickets.length === 0) && (
          <p className="text-center text-muted-foreground py-8">
            Aucun ticket
          </p>
        )}
      </div>
    </div>
  );
}
