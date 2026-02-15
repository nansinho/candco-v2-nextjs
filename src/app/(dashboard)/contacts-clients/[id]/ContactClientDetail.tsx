"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Archive, ArchiveRestore, Loader2, Building2, Mail, Phone, RefreshCw, Lock, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import {
  updateContactClient,
  archiveContactClient,
  unarchiveContactClient,
  type UpdateContactClientInput,
} from "@/actions/contacts-clients";
import { TachesActivitesTab } from "@/components/shared/taches-activites";
import { HistoriqueTimeline } from "@/components/shared/historique-timeline";
import { ExtranetAccessPanel } from "@/components/shared/extranet-access-panel";
import { formatDate } from "@/lib/utils";
import { useBreadcrumb } from "@/components/layout/breadcrumb-context";
import { QuickActionsBar } from "@/components/shared/quick-actions-bar";

// ─── Types ───────────────────────────────────────────────

interface ContactClientData {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
  sync_source_apprenant_id: string | null;
  created_at: string;
  updated_at: string | null;
}

interface EntrepriseLink {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  adresse_ville: string | null;
}

interface ContactClientDetailProps {
  contact: ContactClientData;
  entreprises: EntrepriseLink[];
}

// ─── Component ───────────────────────────────────────────

export function ContactClientDetail({ contact, entreprises }: ContactClientDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  useBreadcrumb(contact.id, `${contact.prenom} ${contact.nom}`);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});

  const [form, setForm] = React.useState<UpdateContactClientInput>({
    civilite: contact.civilite ?? "",
    prenom: contact.prenom,
    nom: contact.nom,
    email: contact.email ?? "",
    telephone: contact.telephone ?? "",
    fonction: contact.fonction ?? "",
  });

  const updateField = (field: keyof UpdateContactClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});

    const result = await updateContactClient(contact.id, form);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    toast({
      title: "Contact mis à jour",
      description: "Les informations ont été enregistrées.",
      variant: "success",
    });
  };

  const handleArchive = async () => {
    if (!(await confirm({ title: "Archiver ce contact client ?", description: "Le contact sera masqué des listes mais pourra être restauré.", confirmLabel: "Archiver", variant: "destructive" }))) return;
    setIsArchiving(true);
    await archiveContactClient(contact.id);
    toast({
      title: "Contact archivé",
      description: "Le contact a été archivé avec succès.",
      variant: "success",
    });
    router.push("/contacts-clients");
  };

  const isArchived = !!(contact as unknown as { archived_at?: string }).archived_at;
  const isSynced = !!contact.sync_source_apprenant_id;

  const handleUnarchive = async () => {
    await unarchiveContactClient(contact.id);
    router.push("/contacts-clients");
  };

  return (
    <div className="space-y-6">
      {isArchived && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm text-amber-400">Ce contact est archivé.</p>
          <Button size="sm" variant="outline" className="h-8 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={handleUnarchive}>
            <ArchiveRestore className="mr-1.5 h-3 w-3" />
            Restaurer
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push("/contacts-clients")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {contact.prenom} {contact.nom}
              </h1>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs font-mono">
                {contact.numero_affichage}
              </Badge>
              {isSynced && (
                <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
                  <RefreshCw className="mr-1 h-2.5 w-2.5" />
                  Synchronisé depuis Organisation
                </Badge>
              )}
            </div>
            {contact.fonction && (
              <p className="mt-0.5 text-xs text-muted-foreground">{contact.fonction}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/50"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Archive className="mr-1.5 h-3 w-3" />
            )}
            Archiver
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-3 w-3" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActionsBar
        email={contact.email}
        telephone={contact.telephone}
        emailContextLabel={`${contact.prenom} ${contact.nom}`}
      />

      {/* Content: Tabs + Side Panel */}
      <div className="flex gap-6">
        {/* Main content */}
        <div className="flex-1 min-w-0">
      <Tabs defaultValue="informations">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="informations" className="text-xs">
            Informations
          </TabsTrigger>
          <TabsTrigger value="entreprises" className="text-xs">
            Entreprises
            {entreprises.length > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                {entreprises.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="taches" className="text-xs">
            Tâches et activités
          </TabsTrigger>
          <TabsTrigger value="historique" className="text-xs">
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Informations */}
        <TabsContent value="informations" className="mt-6">
          <div className="rounded-lg border border-border/60 bg-card p-6">
            {errors._form && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errors._form.join(", ")}
              </div>
            )}

            {isSynced && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
                <Lock className="mt-0.5 h-3.5 w-3.5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs text-blue-300">
                    Les champs ci-dessous sont synchronisés avec la fiche apprenant source (rôle Direction).
                  </p>
                  <button
                    className="mt-1 inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                    onClick={() => router.push(`/apprenants/${contact.sync_source_apprenant_id}`)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Voir la fiche apprenant
                  </button>
                </div>
              </div>
            )}

            <div className="grid gap-5">
              {/* Civilité */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  Civilité
                  {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                </Label>
                <select
                  value={form.civilite ?? ""}
                  onChange={(e) => updateField("civilite", e.target.value)}
                  disabled={isSynced}
                  className="h-9 w-full max-w-xs rounded-md border border-border/60 bg-muted px-3 py-1 text-sm text-foreground disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Aucune --</option>
                  <option value="Monsieur">Monsieur</option>
                  <option value="Madame">Madame</option>
                </select>
              </div>

              {/* Prénom / Nom */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    Prénom <span className="text-destructive">*</span>
                    {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                  </Label>
                  <Input
                    value={form.prenom ?? ""}
                    onChange={(e) => updateField("prenom", e.target.value)}
                    disabled={isSynced}
                    className="h-9 text-sm border-border/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {errors.prenom && (
                    <p className="text-xs text-destructive">{errors.prenom[0]}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1.5">
                    Nom <span className="text-destructive">*</span>
                    {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                  </Label>
                  <Input
                    value={form.nom ?? ""}
                    onChange={(e) => updateField("nom", e.target.value)}
                    disabled={isSynced}
                    className="h-9 text-sm border-border/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {errors.nom && (
                    <p className="text-xs text-destructive">{errors.nom[0]}</p>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  Email
                  {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    disabled={isSynced}
                    className="h-9 text-sm border-border/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {form.email && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-border/60"
                      onClick={() => {
                        if (form.email) window.location.href = `mailto:${form.email}`;
                      }}
                      title="Envoyer un email"
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email[0]}</p>
                )}
              </div>

              {/* Téléphone */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  Téléphone
                  {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={form.telephone ?? ""}
                    onChange={(e) => updateField("telephone", e.target.value)}
                    disabled={isSynced}
                    className="h-9 text-sm border-border/60 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {form.telephone && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 shrink-0 border-border/60"
                      onClick={() => {
                        if (form.telephone) window.location.href = `tel:${form.telephone}`;
                      }}
                      title="Appeler"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Fonction */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  Fonction
                  {isSynced && <Lock className="h-3 w-3 text-blue-400/60" />}
                </Label>
                <Input
                  value={form.fonction ?? ""}
                  onChange={(e) => updateField("fonction", e.target.value)}
                  disabled={isSynced}
                  placeholder="Ex: Responsable formation, DRH, Directeur..."
                  className="h-9 text-sm border-border/60 disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* Meta info */}
            <div className="mt-6 flex items-center gap-4 border-t border-border/40 pt-4">
              <p className="text-xs text-muted-foreground/60">
                Créé le {formatDate(contact.created_at)}
              </p>
              {contact.updated_at && (
                <p className="text-xs text-muted-foreground/60">
                  Modifié le {formatDate(contact.updated_at)}
                </p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Entreprises */}
        <TabsContent value="entreprises" className="mt-6">
          <div className="rounded-lg border border-border/60 bg-card">
            {entreprises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/50">
                  <Building2 className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <p className="mt-3 text-sm font-medium text-muted-foreground/60">
                  Aucune entreprise associée
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/40">
                  Ce contact n&apos;est rattaché à aucune entreprise pour le moment.
                </p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      ID
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Nom
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      SIRET
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Email
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Ville
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entreprises.map((ent) => (
                    <tr
                      key={ent.id}
                      className="border-b border-border/40 transition-colors hover:bg-muted/20 cursor-pointer"
                      onClick={() => router.push(`/entreprises/${ent.id}`)}
                    >
                      <td className="px-4 py-2.5">
                        <span className="font-mono text-xs text-muted-foreground">{ent.numero_affichage}</span>
                      </td>
                      <td className="px-4 py-2.5 text-sm font-medium">{ent.nom}</td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {ent.siret ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {ent.email ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {ent.adresse_ville ?? <span className="text-muted-foreground/40">--</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* Tab 3: Tâches et activités */}
        <TabsContent value="taches" className="mt-6">
          <TachesActivitesTab entiteType="contact_client" entiteId={contact.id} />
        </TabsContent>

        {/* Tab 4: Historique */}
        <TabsContent value="historique" className="mt-6">
          <HistoriqueTimeline
            queryParams={{ mode: "entity", entiteType: "contact_client", entiteId: contact.id }}
            emptyLabel="ce contact client"
            headerDescription="Journal de traçabilité de toutes les actions liées à ce contact client"
          />
        </TabsContent>
      </Tabs>
        </div>

        {/* Side panel */}
        <div className="hidden w-[280px] shrink-0 space-y-4 lg:block">
          {isSynced && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                <h3 className="text-xs font-semibold text-blue-300">Contact synchronisé</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ce contact est synchronisé automatiquement avec un apprenant ayant le rôle &quot;Direction&quot; dans l&apos;organisation d&apos;une entreprise.
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Les modifications doivent être effectuées sur la fiche apprenant source.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 w-full text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10"
                onClick={() => router.push(`/apprenants/${contact.sync_source_apprenant_id}`)}
              >
                <ExternalLink className="mr-1.5 h-3 w-3" />
                Fiche apprenant
              </Button>
            </div>
          )}
          <ExtranetAccessPanel
            entiteType="contact_client"
            entiteId={contact.id}
            email={form.email ?? null}
            prenom={contact.prenom}
            nom={contact.nom}
          />
        </div>
      </div>
      <ConfirmDialog />
    </div>
  );
}
