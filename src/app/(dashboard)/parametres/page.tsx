import { getOrganisationSettings } from "@/actions/parametres";
import { ParametresClient } from "./parametres-client";

export default async function ParametresPage() {
  const { data: settings, error } = await getOrganisationSettings();

  if (error || !settings) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-semibold tracking-tight">Paramètres</h1>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Erreur lors du chargement des paramètres : {error || "Données non trouvées"}
        </div>
      </div>
    );
  }

  return <ParametresClient settings={settings} />;
}
