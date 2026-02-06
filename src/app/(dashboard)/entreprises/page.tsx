"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2 } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
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
import { useToast } from "@/components/ui/toast";
import { getEntreprises, createEntreprise } from "@/actions/entreprises";
import { formatDate } from "@/lib/utils";

interface Entreprise {
  id: string;
  numero_affichage: string;
  nom: string;
  siret: string | null;
  email: string | null;
  telephone: string | null;
  adresse_ville: string | null;
  created_at: string;
}

const columns: Column<Entreprise>[] = [
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
    key: "nom",
    label: "Nom",
    render: (item) => (
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Building2 className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="font-medium">{item.nom}</span>
      </div>
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
    key: "telephone",
    label: "Téléphone",
    render: (item) =>
      item.telephone || <span className="text-muted-foreground/40">--</span>,
  },
  {
    key: "created_at",
    label: "Créé le",
    className: "w-28",
    render: (item) => (
      <span className="text-muted-foreground">{formatDate(item.created_at)}</span>
    ),
  },
];

export default function EntreprisesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Entreprise[]>([]);
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
    const result = await getEntreprises(page, debouncedSearch);
    setData(result.data as Entreprise[]);
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
      title: "Entreprise créée",
      description: "L'entreprise a été ajoutée avec succès.",
      variant: "success",
    });
  };

  return (
    <>
      <DataTable
        title="Entreprises"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter une entreprise"
        onRowClick={(item) => router.push(`/entreprises/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="entreprises"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter une entreprise</DialogTitle>
            <DialogDescription>
              Renseignez les informations principales de l'entreprise.
            </DialogDescription>
          </DialogHeader>
          <CreateEntrepriseForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

interface CreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

function CreateEntrepriseForm({ onSuccess, onCancel }: CreateFormProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const input = {
      nom: formData.get("nom") as string,
      siret: formData.get("siret") as string,
      email: formData.get("email") as string,
      telephone: formData.get("telephone") as string,
      adresse_rue: formData.get("adresse_rue") as string,
      adresse_cp: formData.get("adresse_cp") as string,
      adresse_ville: formData.get("adresse_ville") as string,
    };

    const result = await createEntreprise(input);

    if (result.error) {
      if (typeof result.error === "object" && "_form" in result.error) {
        setErrors({ _form: result.error._form as string[] });
      } else {
        setErrors(result.error as Record<string, string[]>);
      }
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form[0]}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-[13px]">
          Nom de l'entreprise <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          name="nom"
          required
          placeholder="Ex: Acme Corp"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.nom && (
          <p className="text-xs text-destructive">{errors.nom[0]}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="siret" className="text-[13px]">
            SIRET
          </Label>
          <Input
            id="siret"
            name="siret"
            placeholder="123 456 789 00012"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="telephone" className="text-[13px]">
            Téléphone
          </Label>
          <Input
            id="telephone"
            name="telephone"
            placeholder="01 23 45 67 89"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email" className="text-[13px]">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="contact@entreprise.fr"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="adresse_rue" className="text-[13px]">
          Adresse
        </Label>
        <Input
          id="adresse_rue"
          name="adresse_rue"
          placeholder="Rue"
          className="h-9 text-[13px] border-border/60"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="adresse_cp" className="text-[13px]">
            Code postal
          </Label>
          <Input
            id="adresse_cp"
            name="adresse_cp"
            placeholder="75001"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="adresse_ville" className="text-[13px]">
            Ville
          </Label>
          <Input
            id="adresse_ville"
            name="adresse_ville"
            placeholder="Paris"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
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
            "Créer l'entreprise"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
