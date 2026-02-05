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
import { getFormateurs, createFormateur, type FormateurInput } from "@/actions/formateurs";
import { formatCurrency } from "@/lib/utils";

interface Formateur {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  statut_bpf: string;
  tarif_journalier: number | null;
  created_at: string;
}

const columns: Column<Formateur>[] = [
  { key: "numero_affichage", label: "ID", className: "w-28" },
  {
    key: "nom_complet",
    label: "Nom",
    render: (item) => (
      <span className="font-medium">
        {item.prenom} {item.nom}
      </span>
    ),
  },
  { key: "email", label: "Email" },
  {
    key: "statut_bpf",
    label: "Statut BPF",
    className: "w-32",
    render: (item) => (
      <Badge
        className={
          item.statut_bpf === "interne"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-blue-500/10 text-blue-400 border-blue-500/20"
        }
      >
        {item.statut_bpf === "interne" ? "Interne" : "Externe"}
      </Badge>
    ),
  },
  {
    key: "tarif_journalier",
    label: "Tarif/jour",
    className: "w-32",
    render: (item) =>
      item.tarif_journalier != null ? (
        <span className="text-muted-foreground">
          {formatCurrency(item.tarif_journalier)}
        </span>
      ) : (
        <span className="text-muted-foreground/40">--</span>
      ),
  },
  {
    key: "created_at",
    label: "Cree le",
    className: "w-28",
    render: (item) => new Date(item.created_at).toLocaleDateString("fr-FR"),
  },
];

export default function FormateursPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Formateur[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<Record<string, string[]>>({});

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getFormateurs(page, debouncedSearch);
    setData(result.data as Formateur[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Form state
  const [formData, setFormData] = React.useState<FormateurInput>({
    civilite: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    statut_bpf: "externe",
    tarif_journalier: undefined,
  });

  const resetForm = () => {
    setFormData({
      civilite: "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      statut_bpf: "externe",
      tarif_journalier: undefined,
    });
    setFormErrors({});
  };

  const handleCreate = async () => {
    setIsSubmitting(true);
    setFormErrors({});
    const result = await createFormateur(formData);
    setIsSubmitting(false);

    if (result.error) {
      setFormErrors(result.error as Record<string, string[]>);
      return;
    }

    setDialogOpen(false);
    resetForm();
    fetchData();
  };

  return (
    <>
      <DataTable
        title="Formateurs"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => {
          resetForm();
          setDialogOpen(true);
        }}
        addLabel="Ajouter un formateur"
        onRowClick={(item) => router.push(`/formateurs/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
      />

      {/* Create Formateur Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Ajouter un formateur</DialogTitle>
            <DialogDescription>
              Renseignez les informations du nouveau formateur.
            </DialogDescription>
          </DialogHeader>

          {formErrors._form && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {formErrors._form.join(", ")}
            </div>
          )}

          <div className="grid gap-4 py-2">
            {/* Civilite */}
            <div className="grid gap-1.5">
              <Label htmlFor="civilite" className="text-[13px]">
                Civilite
              </Label>
              <select
                id="civilite"
                value={formData.civilite ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, civilite: e.target.value }))
                }
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">--</option>
                <option value="Monsieur">Monsieur</option>
                <option value="Madame">Madame</option>
              </select>
            </div>

            {/* Prenom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="prenom" className="text-[13px]">
                  Prenom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, prenom: e.target.value }))
                  }
                  placeholder="Jean"
                  className="h-9 text-[13px] bg-card border-border/60"
                />
                {formErrors.prenom && (
                  <p className="text-xs text-destructive">{formErrors.prenom[0]}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nom" className="text-[13px]">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nom: e.target.value }))
                  }
                  placeholder="Dupont"
                  className="h-9 text-[13px] bg-card border-border/60"
                />
                {formErrors.nom && (
                  <p className="text-xs text-destructive">{formErrors.nom[0]}</p>
                )}
              </div>
            </div>

            {/* Email + Telephone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-[13px]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="jean@exemple.fr"
                  className="h-9 text-[13px] bg-card border-border/60"
                />
                {formErrors.email && (
                  <p className="text-xs text-destructive">{formErrors.email[0]}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="telephone" className="text-[13px]">
                  Telephone
                </Label>
                <Input
                  id="telephone"
                  value={formData.telephone ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, telephone: e.target.value }))
                  }
                  placeholder="06 12 34 56 78"
                  className="h-9 text-[13px] bg-card border-border/60"
                />
              </div>
            </div>

            {/* Statut BPF + Tarif journalier */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="statut_bpf" className="text-[13px]">
                  Statut BPF
                </Label>
                <select
                  id="statut_bpf"
                  value={formData.statut_bpf}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      statut_bpf: e.target.value as "interne" | "externe",
                    }))
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="externe">Externe (sous-traitant)</option>
                  <option value="interne">Interne (salarie)</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tarif_journalier" className="text-[13px]">
                  Tarif journalier HT
                </Label>
                <Input
                  id="tarif_journalier"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tarif_journalier ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      tarif_journalier: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    }))
                  }
                  placeholder="300.00"
                  className="h-9 text-[13px] bg-card border-border/60"
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
              disabled={isSubmitting}
              className="text-[13px]"
            >
              {isSubmitting ? "Creation..." : "Creer le formateur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
