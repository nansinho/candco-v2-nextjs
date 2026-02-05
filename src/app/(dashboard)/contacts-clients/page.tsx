"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { Loader2 } from "lucide-react";
import {
  getContactsClients,
  createContactClient,
  type CreateContactClientInput,
} from "@/actions/contacts-clients";

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
  { key: "fonction", label: "Fonction" },
  { key: "telephone", label: "Telephone" },
  {
    key: "created_at",
    label: "Cree le",
    render: (item) => new Date(item.created_at).toLocaleDateString("fr-FR"),
  },
];

// ─── Civilite options ────────────────────────────────────

const CIVILITE_OPTIONS = [
  { value: "", label: "-- Aucune --" },
  { value: "Monsieur", label: "Monsieur" },
  { value: "Madame", label: "Madame" },
];

// ─── Page Component ──────────────────────────────────────

export default function ContactsClientsPage() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<ContactClient[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Debounced search
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
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

  const handleCreated = () => {
    setDialogOpen(false);
    fetchData();
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
      />
      <CreateContactDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

// ─── Create Dialog ───────────────────────────────────────

function CreateContactDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
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

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
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
    onCreated();
  };

  const updateField = (field: keyof CreateContactClientInput, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter un contact client</DialogTitle>
          <DialogDescription>
            Renseignez les informations du contact client.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {errors._form && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {errors._form.join(", ")}
              </div>
            )}

            {/* Civilite */}
            <div className="grid gap-1.5">
              <Label htmlFor="civilite" className="text-xs text-muted-foreground">
                Civilite
              </Label>
              <select
                id="civilite"
                value={form.civilite ?? ""}
                onChange={(e) => updateField("civilite", e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CIVILITE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Prenom / Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="prenom" className="text-xs text-muted-foreground">
                  Prenom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prenom"
                  value={form.prenom}
                  onChange={(e) => updateField("prenom", e.target.value)}
                  placeholder="Jean"
                  className="bg-transparent text-[13px]"
                />
                {errors.prenom && (
                  <p className="text-[11px] text-destructive">{errors.prenom[0]}</p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="nom" className="text-xs text-muted-foreground">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  value={form.nom}
                  onChange={(e) => updateField("nom", e.target.value)}
                  placeholder="Dupont"
                  className="bg-transparent text-[13px]"
                />
                {errors.nom && (
                  <p className="text-[11px] text-destructive">{errors.nom[0]}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-xs text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ""}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="jean.dupont@entreprise.fr"
                className="bg-transparent text-[13px]"
              />
              {errors.email && (
                <p className="text-[11px] text-destructive">{errors.email[0]}</p>
              )}
            </div>

            {/* Telephone */}
            <div className="grid gap-1.5">
              <Label htmlFor="telephone" className="text-xs text-muted-foreground">
                Telephone
              </Label>
              <Input
                id="telephone"
                value={form.telephone ?? ""}
                onChange={(e) => updateField("telephone", e.target.value)}
                placeholder="06 12 34 56 78"
                className="bg-transparent text-[13px]"
              />
            </div>

            {/* Fonction */}
            <div className="grid gap-1.5">
              <Label htmlFor="fonction" className="text-xs text-muted-foreground">
                Fonction
              </Label>
              <Input
                id="fonction"
                value={form.fonction ?? ""}
                onChange={(e) => updateField("fonction", e.target.value)}
                placeholder="Responsable formation"
                className="bg-transparent text-[13px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="text-xs"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="text-xs">
              {isSubmitting && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
