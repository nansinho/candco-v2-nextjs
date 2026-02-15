import { getExtranetUserContext } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FileText, Download, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function FormateurDocumentsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "formateur") redirect("/login");

  const admin = createAdminClient();

  // Fetch documents linked to this formateur
  const { data: documents } = await admin
    .from("documents")
    .select("id, nom, categorie, fichier_url, taille_octets, mime_type, created_at")
    .eq("entite_type", "formateur")
    .eq("entite_id", ctx.entiteId)
    .eq("visible_extranet", true)
    .order("created_at", { ascending: false });

  const docs = documents ?? [];

  const categorieLabels: Record<string, string> = {
    contrat_sous_traitance: "Contrat de sous-traitance",
    convention: "Convention",
    attestation: "Attestation",
    programme: "Programme",
    cv: "CV",
    diplome: "Diplôme",
    certification: "Certification",
    piece_identite: "Pièce d'identité",
    autre: "Autre",
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contrats, conventions et ressources pedagogiques
        </p>
      </div>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/20" />
          <p className="mt-3 text-sm font-medium text-muted-foreground/60">
            Aucun document pour le moment
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Vos contrats de sous-traitance, conventions et ressources pedagogiques apparaitront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30 shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground/60" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.nom}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {doc.categorie && (
                    <span className="text-xs text-muted-foreground/60">
                      {categorieLabels[doc.categorie] ?? doc.categorie}
                    </span>
                  )}
                  {doc.taille_octets && (
                    <span className="text-xs text-muted-foreground/40">
                      {formatSize(doc.taille_octets)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/40">
                    <Calendar className="h-3 w-3" />
                    {new Date(doc.created_at).toLocaleDateString("fr-FR")}
                  </span>
                </div>
              </div>
              {doc.fichier_url && (
                <a
                  href={doc.fichier_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-md p-2 text-muted-foreground/60 hover:text-primary hover:bg-primary/10 transition-colors"
                  title="Telecharger"
                >
                  <Download className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
