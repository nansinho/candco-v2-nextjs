import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminOrganisationsPage() {
  const admin = createAdminClient();

  const { data: organisations } = await admin
    .from("organisations")
    .select("id, nom, siret, nda, email, created_at")
    .order("created_at", { ascending: false });

  // Get user counts per org
  const { data: userCounts } = await admin
    .from("utilisateurs")
    .select("organisation_id");

  const orgUserCounts: Record<string, number> = {};
  userCounts?.forEach((u: { organisation_id: string }) => {
    orgUserCounts[u.organisation_id] = (orgUserCounts[u.organisation_id] || 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Organisations</h2>
        <p className="text-muted-foreground">
          {organisations?.length || 0} organismes de formation inscrits
        </p>
      </div>

      <div className="grid gap-4">
        {organisations?.map((org) => (
          <Card key={org.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{org.nom}</CardTitle>
                <Badge variant="outline">
                  {orgUserCounts[org.id] || 0} utilisateur(s)
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-sm text-muted-foreground">
                {org.siret && <span>SIRET : {org.siret}</span>}
                {org.nda && <span>NDA : {org.nda}</span>}
                {org.email && <span>{org.email}</span>}
                <span>
                  Inscrit le{" "}
                  {new Date(org.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!organisations || organisations.length === 0) && (
          <p className="text-center text-muted-foreground py-8">
            Aucune organisation inscrite
          </p>
        )}
      </div>
    </div>
  );
}
