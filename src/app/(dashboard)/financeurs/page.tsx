"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { getFinanceurs, createFinanceur } from "@/actions/financeurs";

interface Financeur {
  id: string;
  numero_affichage: string;
  nom: string;
  type: string | null;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  created_at: string;
}

const FINANCEUR_TYPES = [
  "OPCO",
  "Pôle Emploi",
  "Région",
  "AGEFIPH",
  "Entreprise",
  "Autre",
] as const;

function typeBadgeClass(type: string | null): string {
  switch (type) {
    case "OPCO":
      return "border-transparent bg-blue-500/15 text-blue-400";
    case "Pôle Emploi":
      return "border-transparent bg-purple-500/15 text-purple-400";
    case "Région":
      return "border-transparent bg-emerald-500/15 text-emerald-400";
    case "AGEFIPH":
      return "border-transparent bg-amber-500/15 text-amber-400";
    case "Entreprise":
      return "border-transparent bg-slate-500/15 text-slate-400";
    case "Autre":
      return "border-transparent bg-gray-500/15 text-gray-400";
    default:
      return "border-transparent bg-gray-500/15 text-gray-500";
  }
}

const columns: Column<Financeur>[] = [
  { key: "numero_affichage", label: "ID", className: "w-28" },
  {
    key: "nom",
    label: "Nom",
    render: (item) => <span className="font-medium">{item.nom}</span>,
  },
  {
    key: "type",
    label: "Type",
    render: (item) =>
      item.type ? (
        <Badge className={typeBadgeClass(item.type)}>{item.type}</Badge>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "siret",
    label: "SIRET",
    render: (item) =>
      item.siret || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "email",
    label: "Email",
    render: (item) =>
      item.email || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "created_at",
    label: "Créé le",
    render: (item) =>
      new Date(item.created_at).toLocaleDateString("fr-FR"),
  },
];

export default function FinanceursPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Financeur[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Form state
  const [formNom, setFormNom] = React.useState("");
  const [formType, setFormType] = React.useState("");
  const [formSiret, setFormSiret] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formTelephone, setFormTelephone] = React.useState("");

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getFinanceurs(page, search);
    setData(result.data as Financeur[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, search]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounced search: reset page when search changes
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      // fetchData will be triggered by useEffect
    }, 300);
  };

  const resetForm = () => {
    setFormNom("");
    setFormType("");
    setFormSiret("");
    setFormEmail("");
    setFormTelephone("");
    setFormError(null);
  };

  const handleCreate = async () => {
    setSaving(true);
    setFormError(null);

    const result = await createFinanceur({
      nom: formNom,
      type: formType as typeof FINANCEUR_TYPES[number] | "",
      siret: formSiret,
      email: formEmail,
      telephone: formTelephone,
    });

    setSaving(false);

    if (result.error) {
      const errors = result.error;
      if ("_form" in errors && Array.isArray(errors._form)) {
        setFormError(errors._form[0]);
      } else if ("nom" in errors && Array.isArray(errors.nom)) {
        setFormError(errors.nom[0]);
      } else {
        setFormError("Erreur lors de la création");
      }
      return;
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  return (
    <>
      <DataTable
        title="Financeurs"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={handleSearchChange}
        onAdd={() => {
          resetForm();
          setDialogOpen(true);
        }}
        addLabel="Ajouter un financeur"
        onRowClick={(item) => router.push(`/financeurs/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un financeur</DialogTitle>
            <DialogDescription>
              Créez un nouveau financeur (OPCO, Pôle Emploi, Région, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {formError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {formError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nom" className="text-[13px]">
                Nom <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nom"
                value={formNom}
                onChange={(e) => setFormNom(e.target.value)}
                placeholder="Ex: OPCO Atlas"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-[13px]">
                Type
              </Label>
              <select
                id="type"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[13px] text-foreground"
              >
                <option value="">-- Sélectionner --</option>
                {FINANCEUR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="siret" className="text-[13px]">
                SIRET
              </Label>
              <Input
                id="siret"
                value={formSiret}
                onChange={(e) => setFormSiret(e.target.value)}
                placeholder="Ex: 123 456 789 00012"
                className="h-9 text-[13px] bg-background border-border/60"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="contact@opco.fr"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone" className="text-[13px]">
                  Téléphone
                </Label>
                <Input
                  id="telephone"
                  value={formTelephone}
                  onChange={(e) => setFormTelephone(e.target.value)}
                  placeholder="01 23 45 67 89"
                  className="h-9 text-[13px] bg-background border-border/60"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="text-[13px]"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={saving || !formNom.trim()}
              className="text-[13px]"
            >
              {saving ? "Création..." : "Créer le financeur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
