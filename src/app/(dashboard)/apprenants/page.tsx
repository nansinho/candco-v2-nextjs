"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
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
import { getApprenants, createApprenant, type CreateApprenantInput } from "@/actions/apprenants";
import { formatDate } from "@/lib/utils";

interface Apprenant {
  id: string;
  numero_affichage: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string;
}

const columns: Column<Apprenant>[] = [
  {
    key: "numero_affichage",
    label: "ID",
    className: "w-28",
    render: (item) => (
      <span className="font-mono text-xs text-muted-foreground">
        {item.numero_affichage}
      </span>
    ),
  },
  {
    key: "nom_complet",
    label: "Nom",
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-500/10">
          <GraduationCap className="h-3.5 w-3.5 text-blue-400" />
        </div>
        <span className="font-medium">
          {item.prenom} {item.nom}
        </span>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    render: (item) =>
      item.email || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "telephone",
    label: "T\u00e9l\u00e9phone",
    render: (item) =>
      item.telephone || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "created_at",
    label: "Cr\u00e9\u00e9 le",
    className: "w-28",
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

export default function ApprenantsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Apprenant[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);

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
    const result = await getApprenants(page, debouncedSearch);
    setData(result.data as Apprenant[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSuccess = () => {
    setDialogOpen(false);
    fetchData();
    toast({
      title: "Apprenant cr\u00e9\u00e9",
      description: "L'apprenant a \u00e9t\u00e9 ajout\u00e9 avec succ\u00e8s.",
      variant: "success",
    });
  };

  return (
    <>
      <DataTable
        title="Apprenants"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter un apprenant"
        onRowClick={(item) => router.push(`/apprenants/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="apprenants"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un apprenant</DialogTitle>
            <DialogDescription>
              Renseignez les informations du nouvel apprenant.
            </DialogDescription>
          </DialogHeader>
          <CreateApprenantForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create form (inside the dialog)
// ---------------------------------------------------------------------------

interface FormErrors {
  civilite?: string[];
  prenom?: string[];
  nom?: string[];
  email?: string[];
  telephone?: string[];
  date_naissance?: string[];
  _form?: string[];
}

function CreateApprenantForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<FormErrors>({});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const input: CreateApprenantInput = {
      civilite: (formData.get("civilite") as string) || undefined,
      prenom: formData.get("prenom") as string,
      nom: formData.get("nom") as string,
      email: (formData.get("email") as string) || undefined,
      telephone: (formData.get("telephone") as string) || undefined,
      date_naissance: (formData.get("date_naissance") as string) || undefined,
    };

    const result = await createApprenant(input);

    if (result.error) {
      setErrors(result.error as FormErrors);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form[0]}
        </div>
      )}

      {/* Civilit\u00e9 */}
      <div className="space-y-2">
        <Label htmlFor="civilite" className="text-[13px]">
          Civilit\u00e9
        </Label>
        <select
          id="civilite"
          name="civilite"
          defaultValue=""
          className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-[13px] text-foreground"
        >
          <option value="">-- S\u00e9lectionner --</option>
          <option value="Monsieur">Monsieur</option>
          <option value="Madame">Madame</option>
        </select>
      </div>

      {/* Pr\u00e9nom / Nom */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prenom" className="text-[13px]">
            Pr\u00e9nom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prenom"
            name="prenom"
            placeholder="Jean"
            className="h-9 text-[13px] bg-background border-border/60"
          />
          {errors.prenom && (
            <p className="text-xs text-destructive">{errors.prenom[0]}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom" className="text-[13px]">
            Nom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nom"
            name="nom"
            placeholder="Dupont"
            className="h-9 text-[13px] bg-background border-border/60"
          />
          {errors.nom && (
            <p className="text-xs text-destructive">{errors.nom[0]}</p>
          )}
        </div>
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[13px]">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="jean.dupont@example.com"
          className="h-9 text-[13px] bg-background border-border/60"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      {/* T\u00e9l\u00e9phone */}
      <div className="space-y-2">
        <Label htmlFor="telephone" className="text-[13px]">
          T\u00e9l\u00e9phone
        </Label>
        <Input
          id="telephone"
          name="telephone"
          placeholder="06 12 34 56 78"
          className="h-9 text-[13px] bg-background border-border/60"
        />
      </div>

      {/* Date de naissance */}
      <div className="space-y-2">
        <Label htmlFor="date_naissance" className="text-[13px]">
          Date de naissance
        </Label>
        <Input
          id="date_naissance"
          name="date_naissance"
          type="date"
          className="h-9 text-[13px] bg-background border-border/60"
        />
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          className="h-8 text-xs border-border/60"
        >
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              Cr\u00e9ation...
            </>
          ) : (
            "Cr\u00e9er l'apprenant"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
