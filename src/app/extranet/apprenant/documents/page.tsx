import { getExtranetUserContext, getApprenantDocuments } from "@/actions/extranet-context";
import { redirect } from "next/navigation";
import { FileText, Download, Calendar, Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function ApprenantDocumentsPage() {
  const { data: ctx, error } = await getExtranetUserContext();
  if (error || !ctx || ctx.role !== "apprenant") redirect("/login");

  const { data: documents } = await getApprenantDocuments(ctx.entiteId);

  const categorieLabels: Record<string, string> = {
    convention: "Convention",
    attestation: "Attestation",
    certificat: "Certificat",
    programme: "Programme",
    contrat_sous_traitance: "Contrat",
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
        <h1 className="text-xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conventions, attestations et certificats
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/20" />
          <p className="mt-3 text-sm font-medium text-muted-foreground/60">
            Aucun document disponible
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Vos conventions, attestations et certificats apparaitront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/30 shrink-0">
                <FileText className="h-5 w-5 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.nom}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {doc.categorie && (
                    <Badge variant="outline" className="text-[10px] border-border/60 py-0">
                      {categorieLabels[doc.categorie] ?? doc.categorie}
                    </Badge>
                  )}
                  {doc.session_nom && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                      <Layers className="h-3 w-3" />
                      {doc.session_nom}
                    </span>
                  )}
                  {doc.taille_octets && (
                    <span className="text-[11px] text-muted-foreground/40">
                      {formatSize(doc.taille_octets)}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
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
