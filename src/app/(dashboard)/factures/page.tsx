"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Receipt, Building2, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { DatePicker } from "@/components/ui/date-picker";
import {
  getFacturesList,
  createFacture,
  archiveFacture,
  unarchiveFacture,
  deleteFacturesBulk,
  type CreateFactureInput,
} from "@/actions/factures";
import {
  getEntreprisesForSelect,
  getContactsForSelect,
} from "@/actions/devis";
import { FactureStatusBadge, FACTURE_STATUT_OPTIONS } from "@/components/shared/status-badges";
import { LignesEditor, type LigneItem } from "@/components/shared/lignes-editor";
import { formatDate, formatCurrency } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface FactureRow {
  id: string;
  numero_affichage: string;
  objet: string | null;
  statut: string;
  date_emission: string;
  date_echeance: string | null;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  montant_paye: number;
  archived_at: string | null;
  created_at: string;
  entreprises: { nom: string } | null;
  contacts_clients: { prenom: string; nom: string } | null;
}

interface EntrepriseOption {
  id: string;
  nom: string;
  numero_affichage: string;
}

interface ContactOption {
  id: string;
  prenom: string;
  nom: string;
  numero_affichage: string;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<FactureRow>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    sortable: true,
    minWidth: 130,
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">{item.numero_affichage}</span>
    ),
  },
  {
    key: "statut",
    label: "Statut",
    filterType: "select",
    filterOptions: FACTURE_STATUT_OPTIONS,
    minWidth: 140,
    render: (item) => <FactureStatusBadge statut={item.statut} />,
  },
  {
    key: "objet",
    label: "Objet",
    sortable: true,
    filterType: "text",
    minWidth: 250,
    render: (item) => (
      <div className="flex items-center gap-2">
        <Receipt className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[13px] truncate">{item.objet || "Sans objet"}</span>
      </div>
    ),
  },
  {
    key: "destinataire",
    label: "Destinataire",
    minWidth: 180,
    render: (item) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[13px] truncate">{item.entreprises?.nom || "--"}</span>
      </div>
    ),
  },
  {
    key: "total_ttc",
    label: "Montant TTC",
    sortable: true,
    minWidth: 130,
    render: (item) => (
      <span className="font-mono text-[13px]">{formatCurrency(Number(item.total_ttc))}</span>
    ),
  },
  {
    key: "montant_paye",
    label: "Payé",
    minWidth: 160,
    render: (item) => {
      const paye = Number(item.montant_paye) || 0;
      const total = Number(item.total_ttc) || 0;
      const isFullyPaid = total > 0 && paye >= total;
      return (
        <span className={`font-mono text-[13px] ${isFullyPaid ? "text-green-500" : "text-muted-foreground"}`}>
          {formatCurrency(paye)} / {formatCurrency(total)}
        </span>
      );
    },
  },
  {
    key: "date_emission",
    label: "Émission",
    sortable: true,
    filterType: "date",
    minWidth: 110,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.date_emission)}</span>
    ),
  },
  {
    key: "date_echeance",
    label: "Échéance",
    sortable: true,
    filterType: "date",
    defaultVisible: false,
    minWidth: 110,
    render: (item) => (
      <span className="text-muted-foreground">{item.date_echeance ? formatDate(item.date_echeance) : "--"}</span>
    ),
  },
  {
    key: "created_at",
    label: "Créé le",
    sortable: true,
    filterType: "date",
    defaultVisible: false,
    minWidth: 110,
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

// ─── Page Component ──────────────────────────────────────

export default function FacturesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // DataTable state
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<FactureRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showArchived, setShowArchived] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [filters, setFilters] = React.useState<ActiveFilter[]>([]);

  // Create dialog state
  const [dialogOpen, setDialogOpen] = React.useState(false);

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
      const result = await getFacturesList(page, debouncedSearch, showArchived, sortBy, sortDir, filters);
      setData(result.data as FactureRow[]);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, showArchived, sortBy, sortDir, filters]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

  const handleCreateSuccess = (factureId: string) => {
    setDialogOpen(false);
    fetchData();
    toast({
      title: "Facture créée",
      description: "La facture a été créée avec succès.",
      variant: "success",
    });
    router.push(`/factures/${factureId}`);
  };

  return (
    <>
      <DataTable
        title="Factures"
        tableId="factures"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Nouvelle facture"
        onRowClick={(item) => router.push(`/factures/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="factures"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={(f) => { setFilters(f); setPage(1); }}
        showArchived={showArchived}
        onToggleArchived={(show) => { setShowArchived(show); setPage(1); }}
        onArchive={async (ids) => {
          await Promise.all(ids.map((id) => archiveFacture(id)));
          await fetchData();
          toast({ title: "Archivé", description: `${ids.length} facture(s) archivée(s).`, variant: "success" });
        }}
        onUnarchive={async (ids) => {
          await Promise.all(ids.map((id) => unarchiveFacture(id)));
          setShowArchived(false);
          toast({ title: "Restauré", description: `${ids.length} facture(s) restaurée(s).`, variant: "success" });
        }}
        onDelete={async (ids) => {
          await deleteFacturesBulk(ids);
          await fetchData();
          toast({ title: "Supprimé", description: `${ids.length} facture(s) supprimée(s).`, variant: "success" });
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture</DialogTitle>
            <DialogDescription>
              Créez une facture. Vous pourrez compléter les détails ensuite.
            </DialogDescription>
          </DialogHeader>
          <CreateFactureForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateFactureForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: (factureId: string) => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [objet, setObjet] = React.useState("");
  const [entrepriseId, setEntrepriseId] = React.useState("");
  const [contactClientId, setContactClientId] = React.useState("");
  const [dateEmission, setDateEmission] = React.useState(new Date().toISOString().split("T")[0]);
  const [dateEcheance, setDateEcheance] = React.useState("");
  const [lignes, setLignes] = React.useState<LigneItem[]>([]);

  // Options
  const [entreprises, setEntreprises] = React.useState<EntrepriseOption[]>([]);
  const [contacts, setContacts] = React.useState<ContactOption[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(true);

  React.useEffect(() => {
    async function load() {
      try {
        const [eData, cData] = await Promise.all([
          getEntreprisesForSelect(),
          getContactsForSelect(),
        ]);
        setEntreprises(eData);
        setContacts(cData);
      } finally {
        setOptionsLoading(false);
      }
    }
    load();
  }, []);

  const totals = React.useMemo(() => {
    const total_ht = lignes.reduce((sum, l) => sum + (l.montant_ht ?? l.quantite * l.prix_unitaire_ht), 0);
    const total_tva = lignes.reduce((sum, l) => sum + ((l.montant_ht ?? l.quantite * l.prix_unitaire_ht) * l.taux_tva) / 100, 0);
    return { total_ht, total_tva, total_ttc: total_ht + total_tva };
  }, [lignes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!objet.trim() || !entrepriseId) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir l'objet et sélectionner une entreprise.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const input: CreateFactureInput = {
        objet: objet.trim(),
        entreprise_id: entrepriseId,
        contact_client_id: contactClientId || undefined,
        date_emission: dateEmission,
        date_echeance: dateEcheance || undefined,
        statut: "brouillon",
        lignes,
      };

      const result = await createFacture(input);
      if ("error" in result) {
        toast({
          title: "Erreur",
          description: "Impossible de créer la facture",
          variant: "destructive",
        });
        return;
      }

      onSuccess(result.data.id);
    } catch {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la création",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (optionsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="objet">
          Objet <span className="text-destructive">*</span>
        </Label>
        <Input
          id="objet"
          value={objet}
          onChange={(e) => setObjet(e.target.value)}
          placeholder="Ex: Formation React - Session Mars 2026"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Entreprise <span className="text-destructive">*</span>
          </Label>
          <Select value={entrepriseId} onValueChange={setEntrepriseId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {entreprises.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <span className="font-mono text-[11px] text-muted-foreground mr-2">
                    {e.numero_affichage}
                  </span>
                  {e.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contact client</Label>
          <Select value={contactClientId} onValueChange={setContactClientId}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Optionnel..." />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="font-mono text-[11px] text-muted-foreground mr-2">
                    {c.numero_affichage}
                  </span>
                  {c.prenom} {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Date d{"'"}émission <span className="text-destructive">*</span>
          </Label>
          <DatePicker value={dateEmission} onChange={setDateEmission} />
        </div>
        <div className="space-y-2">
          <Label>Date d{"'"}échéance</Label>
          <DatePicker value={dateEcheance} onChange={setDateEcheance} placeholder="Optionnel..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Lignes de facturation</Label>
        <LignesEditor lignes={lignes} onChange={setLignes} />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-border/60">
        <div className="space-y-1 text-sm">
          <div className="flex gap-4">
            <span className="text-muted-foreground">Total HT:</span>
            <span className="font-mono">{formatCurrency(totals.total_ht)}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-muted-foreground">TVA:</span>
            <span className="font-mono">{formatCurrency(totals.total_tva)}</span>
          </div>
          <div className="flex gap-4">
            <span className="font-medium">Total TTC:</span>
            <span className="font-mono font-semibold">{formatCurrency(totals.total_ttc)}</span>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Création...
              </>
            ) : (
              "Créer la facture"
            )}
          </Button>
        </DialogFooter>
      </div>
    </form>
  );
}
