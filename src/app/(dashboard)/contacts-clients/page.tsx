"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2 } from "lucide-react";
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
import {
  getContactsClients,
  createContactClient,
  type CreateContactClientInput,
} from "@/actions/contacts-clients";
import { formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────

interface ContactClient {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  fonction: string | null;
  created_at: string;
}

// ─── Columns ─────────────────────────────────────────────

const columns: Column<ContactClient>[] = [
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
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/10">
          <Users className="h-3.5 w-3.5 text-purple-400" />
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
    key: "fonction",
    label: "Fonction",
    render: (item) =>
      item.fonction || <span className="text-muted-foreground/40">--</span>,
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

// ─── Page Component ──────────────────────────────────────

export default function ContactsClientsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ContactClient[]>([]);
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
    const result = await getContactsClients(page, debouncedSearch);
    setData(result.data as ContactClient[]);
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
      title: "Contact créé",
      description: "Le contact client a été ajouté avec succès.",
      variant: "success",
    });
  };

  return (
    <>
      <DataTable
        title="Contacts clients"
        columns={columns}
        data={data}
        totalCount={totalCount}
        page={page}
        onPageChange={setPage}
        searchValue={search}
        onSearchChange={setSearch}
        onAdd={() => setDialogOpen(true)}
        addLabel="Ajouter un contact"
        onRowClick={(item) => router.push(`/contacts-clients/${item.id}`)}
        getRowId={(item) => item.id}
        isLoading={isLoading}
        exportFilename="contacts-clients"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un contact client</DialogTitle>
            <DialogDescription>
              Renseignez les informations du contact client.
            </DialogDescription>
          </DialogHeader>
          <CreateContactForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Create Form ─────────────────────────────────────────

function CreateContactForm({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [form, setForm] = React.useState<CreateContactClientInput>({
    civilite: "",
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    fonction: "",
  });

  const resetForm = () => {
    setForm({ civilite: "", prenom: "", nom: "", email: "", telephone: "", fonction: "" });
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = await createContactClient(form);

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
    resetForm();
    onSuccess();
  };

  const updateField = (field: keyof CreateContactClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {errors._form.join(", ")}
        </div>
      )}

      {/* Civilité */}
      <div className="space-y-2">
        <Label htmlFor="civilite" className="text-[13px]">
          Civilité
        </Label>
        <select
          id="civilite"
          value={form.civilite ?? ""}
          onChange={(e) => updateField("civilite", e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-[13px] text-foreground"
        >
          <option value="">-- Sélectionner --</option>
          <option value="Monsieur">Monsieur</option>
          <option value="Madame">Madame</option>
        </select>
      </div>

      {/* Prénom / Nom */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="prenom" className="text-[13px]">
            Prénom <span className="text-destructive">*</span>
          </Label>
          <Input
            id="prenom"
            value={form.prenom}
            onChange={(e) => updateField("prenom", e.target.value)}
            placeholder="Jean"
            className="h-9 text-[13px] border-border/60"
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
            value={form.nom}
            onChange={(e) => updateField("nom", e.target.value)}
            placeholder="Dupont"
            className="h-9 text-[13px] border-border/60"
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
          type="email"
          value={form.email ?? ""}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="jean.dupont@entreprise.fr"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email[0]}</p>
        )}
      </div>

      {/* Téléphone / Fonction */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="telephone" className="text-[13px]">
            Téléphone
          </Label>
          <Input
            id="telephone"
            value={form.telephone ?? ""}
            onChange={(e) => updateField("telephone", e.target.value)}
            placeholder="06 12 34 56 78"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fonction" className="text-[13px]">
            Fonction
          </Label>
          <Input
            id="fonction"
            value={form.fonction ?? ""}
            onChange={(e) => updateField("fonction", e.target.value)}
            placeholder="Responsable formation"
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
            "Créer le contact"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
