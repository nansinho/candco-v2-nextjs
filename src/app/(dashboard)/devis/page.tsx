"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { DataTable, type Column, type ActiveFilter } from "@/components/data-table/DataTable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  getDevisList,
  createDevis,
  archiveDevis,
  unarchiveDevis,
  deleteDevisBulk,
  getEntreprisesForSelect,
  getContactsForSelect,
  getSessionsForDevisSelect,
  getEntrepriseSiegeContacts,
  type CreateDevisInput,
  type SiegeContact,
} from "@/actions/devis";
import { getSessionCommanditaires } from "@/actions/sessions";
import { AIDocumentDialog } from "@/components/shared/ai-document-dialog";
import { formatDate, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { LignesEditor, type LigneItem } from "@/components/shared/lignes-editor";
import {
  DevisStatusBadge,
  DEVIS_STATUT_OPTIONS,
} from "@/components/shared/status-badges";

// ─── Types ───────────────────────────────────────────────

interface DevisRow {
  id: string;
  numero_affichage: string;
  objet: string | null;
  statut: string;
  date_emission: string;
  date_echeance: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  particulier_nom: string | null;
  archived_at: string | null;
  created_at: string;
  entreprises: { nom: string } | null;
  contacts_clients: { prenom: string; nom: string } | null;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<DevisRow>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    sortable: true,
    minWidth: 100,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.numero_affichage}
      </span>
    ),
  },
  {
    key: "statut",
    label: "Statut",
    filterType: "select",
    filterOptions: DEVIS_STATUT_OPTIONS,
    minWidth: 110,
    render: (item) => (
      <DevisStatusBadge statut={item.statut} />
    ),
  },
  {
    key: "objet",
    label: "Objet",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-orange-500/10">
          <FileText className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-medium">
            {item.objet || <span className="text-muted-foreground/40">Sans objet</span>}
          </span>
        </div>
      </div>
    ),
  },
  {
    key: "destinataire",
    label: "Destinataire",
    minWidth: 180,
    render: (item) => {
      const dest = item.entreprises?.nom || item.particulier_nom || "--";
      return (
        <span className="text-sm text-muted-foreground truncate max-w-[180px]">
          {dest}
        </span>
      );
    },
    exportValue: (item) => item.entreprises?.nom || item.particulier_nom || "",
  },
  {
    key: "total_ttc",
    label: "Montant TTC",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <span className="font-mono text-sm">{formatCurrency(item.total_ttc)}</span>
    ),
    exportValue: (item) => item.total_ttc.toString(),
  },
  {
    key: "date_emission",
    label: "Émission",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.date_emission)}</span>
    ),
  },
  {
    key: "date_echeance",
    label: "Échéance",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-muted-foreground">
        {item.date_echeance ? formatDate(item.date_echeance) : "--"}
      </span>
    ),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    filterType: "date",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page Component ──────────────────────────────────────

export default function DevisPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<DevisRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [aiDialogOpen, setAiDialogOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getDevisList(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as DevisRow[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    setDialogOpen(false);
    fetchData();
    toast({
      title: "Devis créé",
      description: "Le devis a été créé avec succès.",
      variant: "success",
    });
  };

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  return (
    <>
      <DataTable
        title="Devis"
        tableId="devis"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouveau devis"
        headerExtra={
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => setAiDialogOpen(true)}
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            <span className="hidden sm:inline">Generer par IA</span>
          </Button>
        }
        onRowClick={(item) => router.push(`/devis/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="devis"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveDevis(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} devis archivé(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveDevis(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} devis restauré(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          const result = await deleteDevisBulk(ids);
          if (result.error) {
            toast({ title: "Erreur", description: result.error, variant: "destructive" });
            return;
          }
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} devis supprimé(s).`, variant: "success" });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[calc(100%-1rem)] sm:w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Nouveau devis</DialogTitle>
            <DialogDescription>
              Créez un devis. Vous pourrez compléter les détails ensuite.
            </DialogDescription>
          </DialogHeader>
          <CreateDevisForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <AIDocumentDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        documentType="devis"
        onSuccess={(id, _type, numero) => {
          fetchData();
          toast({
            title: "Devis genere par IA",
            description: `${numero || "Devis"} cree en brouillon. Verifiez et completez les details.`,
            variant: "success",
          });
          router.push(`/devis/${id}`);
        }}
      />
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

interface SessionOption {
  id: string;
  nom: string;
  numero_affichage: string;
  statut: string;
  date_debut: string | null;
}

interface CommanditaireOption {
  id: string;
  budget: number;
  entreprises: { id: string; nom: string; email: string | null } | null;
  contacts_clients: { id: string; prenom: string; nom: string; email: string | null } | null;
  financeurs: { id: string; nom: string; type: string | null } | null;
}

function CreateDevisForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [entreprises, setEntreprises] = React.useState<{ id: string; nom: string }[]>([]);
  const [contacts, setContacts] = React.useState<{ id: string; prenom: string; nom: string }[]>([]);
  const [sessions, setSessions] = React.useState<SessionOption[]>([]);
  const [commanditaires, setCommanditaires] = React.useState<CommanditaireOption[]>([]);
  const [isParticulier, setIsParticulier] = React.useState(false);
  const [siegeContacts, setSiegeContacts] = React.useState<SiegeContact[]>([]);
  const [contactAutoSelected, setContactAutoSelected] = React.useState(false);
  const [showAllContacts, setShowAllContacts] = React.useState(false);
  const [siegeLoading, setSiegeLoading] = React.useState(false);
  const [noSiegeMembers, setNoSiegeMembers] = React.useState(false);
  const [form, setForm] = React.useState<CreateDevisInput>({
    entreprise_id: "",
    contact_client_id: "",
    particulier_nom: "",
    particulier_email: "",
    particulier_telephone: "",
    particulier_adresse: "",
    date_emission: new Date().toISOString().split("T")[0],
    date_echeance: "",
    objet: "",
    conditions: "",
    mentions_legales: "",
    statut: "brouillon",
    opportunite_id: "",
    session_id: "",
    commanditaire_id: "",
    lignes: [],
    contact_auto_selected: false,
  });

  React.useEffect(() => {
    async function load() {
      const [ent, cont, sess] = await Promise.all([
        getEntreprisesForSelect(),
        getContactsForSelect(),
        getSessionsForDevisSelect(),
      ]);
      setEntreprises(ent);
      setContacts(cont);
      setSessions(sess as SessionOption[]);
    }
    load();
  }, []);

  // Load commanditaires when session changes
  React.useEffect(() => {
    if (!form.session_id) {
      setCommanditaires([]);
      return;
    }
    async function loadCmd() {
      const result = await getSessionCommanditaires(form.session_id!);
      setCommanditaires((result.data ?? []) as CommanditaireOption[]);
    }
    loadCmd();
  }, [form.session_id]);

  // Auto-fill contact from siege social when enterprise changes
  const handleEntrepriseChange = async (newEntrepriseId: string) => {
    updateField("entreprise_id", newEntrepriseId);
    setContactAutoSelected(false);
    setShowAllContacts(false);
    setNoSiegeMembers(false);
    setSiegeContacts([]);
    setForm((prev) => ({ ...prev, contact_client_id: "", contact_auto_selected: false }));

    if (!newEntrepriseId) return;

    setSiegeLoading(true);
    try {
      const result = await getEntrepriseSiegeContacts(newEntrepriseId);
      if (result.error || result.contacts.length === 0) {
        setNoSiegeMembers(true);
        return;
      }
      setSiegeContacts(result.contacts);
      if (result.contacts.length === 1) {
        setForm((prev) => ({
          ...prev,
          contact_client_id: result.contacts[0].contact_client_id,
          contact_auto_selected: true,
        }));
        setContactAutoSelected(true);
      }
    } catch {
      setNoSiegeMembers(true);
    } finally {
      setSiegeLoading(false);
    }
  };

  // Auto-fill entreprise/contact when commanditaire is selected
  const handleCommanditaireChange = (cmdId: string) => {
    setForm((prev) => ({ ...prev, commanditaire_id: cmdId }));
    if (!cmdId) return;
    const cmd = commanditaires.find((c) => c.id === cmdId);
    if (!cmd) return;
    setIsParticulier(false);
    setContactAutoSelected(false);
    setShowAllContacts(false);
    setNoSiegeMembers(false);
    setSiegeContacts([]);
    setForm((prev) => ({
      ...prev,
      commanditaire_id: cmdId,
      entreprise_id: cmd.entreprises?.id || prev.entreprise_id,
      contact_client_id: cmd.contacts_clients?.id || prev.contact_client_id,
      contact_auto_selected: false,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createDevis(form);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSubmitting(false);
      return;
    }

    if ("warning" in result && result.warning) {
      toast({ title: "Attention", description: result.warning, variant: "destructive" });
    }

    setIsSubmitting(false);
    onSuccess();
  };

  const updateField = (field: keyof CreateDevisInput, value: string | LigneItem[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form.join(", ")}
        </div>
      )}

      {/* Session selector (optional) */}
      <div className="space-y-2">
        <Label htmlFor="session_id" className="text-sm">
          Session (optionnel)
        </Label>
        <select
          id="session_id"
          value={form.session_id}
          onChange={(e) => {
            setForm((prev) => ({ ...prev, session_id: e.target.value, commanditaire_id: "" }));
          }}
          className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
        >
          <option value="">-- Aucune session --</option>
          {sessions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.numero_affichage} — {s.nom}
            </option>
          ))}
        </select>
      </div>

      {/* Commanditaire selector (visible when session is selected) */}
      {form.session_id && commanditaires.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="commanditaire_id" className="text-sm">
            Commanditaire
          </Label>
          <select
            id="commanditaire_id"
            value={form.commanditaire_id}
            onChange={(e) => handleCommanditaireChange(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
          >
            <option value="">-- Sélectionner un commanditaire --</option>
            {commanditaires.map((c) => {
              const label = [
                c.entreprises?.nom,
                c.financeurs ? `+ ${c.financeurs.nom}` : null,
                c.budget ? `— ${formatCurrency(c.budget)}` : null,
              ].filter(Boolean).join(" ");
              return (
                <option key={c.id} value={c.id}>
                  {label || "Commanditaire"}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="objet" className="text-sm">
          Objet
        </Label>
        <Input
          id="objet"
          value={form.objet}
          onChange={(e) => updateField("objet", e.target.value)}
          placeholder="Ex: Formation React avancé"
          className="h-9 text-sm border-border/60"
        />
        {errors.objet && (
          <p className="text-xs text-destructive">{errors.objet[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="particulier"
            checked={isParticulier}
            onChange={(e) => setIsParticulier(e.target.checked)}
            className="h-4 w-4"
          />
          <Label htmlFor="particulier" className="text-sm">
            Particulier (sans entreprise)
          </Label>
        </div>
      </div>

      {!isParticulier ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="entreprise_id" className="text-sm">
              Entreprise
            </Label>
            <select
              id="entreprise_id"
              value={form.entreprise_id}
              onChange={(e) => handleEntrepriseChange(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
            >
              <option value="">-- Sélectionner une entreprise --</option>
              {entreprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nom}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="contact_client_id" className="text-sm">
                Contact client
              </Label>
              {contactAutoSelected && (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                  Auto — Siège social
                </span>
              )}
            </div>

            {siegeLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                Chargement des contacts siège...
              </div>
            ) : (
              <>
                <select
                  id="contact_client_id"
                  value={form.contact_client_id}
                  onChange={(e) => {
                    updateField("contact_client_id", e.target.value);
                    setContactAutoSelected(false);
                    setForm((prev) => ({ ...prev, contact_auto_selected: false }));
                  }}
                  className="h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-sm text-foreground"
                >
                  <option value="">-- Sélectionner un contact --</option>
                  {(!showAllContacts && siegeContacts.length > 0)
                    ? siegeContacts.map((c) => (
                        <option key={c.contact_client_id} value={c.contact_client_id}>
                          {c.prenom} {c.nom}
                          {c.fonction ? ` — ${c.fonction}` : ""}
                          {c.roles.length > 0 ? ` (${c.roles.join(", ")})` : ""}
                        </option>
                      ))
                    : contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.prenom} {c.nom}
                        </option>
                      ))
                  }
                </select>

                {noSiegeMembers && form.entreprise_id && (
                  <div className="flex items-start gap-2 text-xs text-amber-400 mt-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>
                      Aucun membre rattaché au siège social.{" "}
                      <a
                        href={`/entreprises/${form.entreprise_id}`}
                        className="underline hover:text-amber-300"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Configurer l&apos;organisation
                      </a>
                    </span>
                  </div>
                )}

                {siegeContacts.length > 0 && !showAllContacts && (
                  <button
                    type="button"
                    onClick={() => setShowAllContacts(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Voir tous les contacts
                  </button>
                )}
                {showAllContacts && siegeContacts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllContacts(false)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Voir uniquement les contacts siège
                  </button>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="particulier_nom" className="text-sm">
              Nom du particulier <span className="text-destructive">*</span>
            </Label>
            <Input
              id="particulier_nom"
              value={form.particulier_nom}
              onChange={(e) => updateField("particulier_nom", e.target.value)}
              placeholder="Ex: Jean Dupont"
              className="h-9 text-sm border-border/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="particulier_email" className="text-sm">
                Email
              </Label>
              <Input
                id="particulier_email"
                type="email"
                value={form.particulier_email}
                onChange={(e) => updateField("particulier_email", e.target.value)}
                placeholder="email@exemple.com"
                className="h-9 text-sm border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="particulier_telephone" className="text-sm">
                Téléphone
              </Label>
              <Input
                id="particulier_telephone"
                value={form.particulier_telephone}
                onChange={(e) => updateField("particulier_telephone", e.target.value)}
                placeholder="06 12 34 56 78"
                className="h-9 text-sm border-border/60"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="particulier_adresse" className="text-sm">
              Adresse
            </Label>
            <Input
              id="particulier_adresse"
              value={form.particulier_adresse}
              onChange={(e) => updateField("particulier_adresse", e.target.value)}
              placeholder="Adresse complète"
              className="h-9 text-sm border-border/60"
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="date_emission" className="text-sm">
            Date d'émission <span className="text-destructive">*</span>
          </Label>
          <DatePicker
            id="date_emission"
            value={form.date_emission}
            onChange={(val) => updateField("date_emission", val)}
          />
          {errors.date_emission && (
            <p className="text-xs text-destructive">{errors.date_emission[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="date_echeance" className="text-sm">
            Date d'échéance
          </Label>
          <DatePicker
            id="date_echeance"
            value={form.date_echeance ?? ""}
            onChange={(val) => updateField("date_echeance", val)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">Lignes du devis</Label>
        <LignesEditor
          lignes={form.lignes}
          onChange={(lignes) => updateField("lignes", lignes)}
        />
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          className="h-8 text-xs border-border/60"
        >
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Création...
            </>
          ) : (
            "Créer le devis"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
