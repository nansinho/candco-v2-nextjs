"use client";

import * as React from "react";
import { DoorOpen, Loader2, MapPin, Users, Trash2, Plus, Pencil } from "lucide-react";
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
import { useConfirm } from "@/components/ui/alert-dialog";
import {
  getSalles,
  createSalle,
  updateSalle,
  deleteSalles,
  type SalleInput,
} from "@/actions/salles";

interface Salle {
  id: string;
  nom: string;
  adresse: string | null;
  capacite: number | null;
  equipements: string | null;
  created_at: string;
}

export default function SallesPage() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<Salle[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingSalle, setEditingSalle] = React.useState<Salle | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getSalles(page, debouncedSearch);
    setData(result.data as Salle[]);
    setTotalCount(result.count);
    setIsLoading(false);
  }, [page, debouncedSearch]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!(await confirm({ title: "Supprimer cette salle ?", description: "Cette action est irréversible.", confirmLabel: "Supprimer", variant: "destructive" }))) return;
    const result = await deleteSalles([id]);
    if (result.error) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
      return;
    }
    fetchData();
    toast({ title: "Salle supprimée", variant: "success" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Salles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez vos salles de formation, leur capacité et leurs équipements.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => { setEditingSalle(null); setDialogOpen(true); }}>
          <Plus className="mr-1.5 h-3 w-3" />
          Ajouter une salle
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une salle..."
          className="h-9 text-[13px] border-border/60"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-20">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <DoorOpen className="h-6 w-6 text-primary" />
          </div>
          <h2 className="mt-4 text-sm font-medium">Aucune salle</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ajoutez votre première salle de formation.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((salle) => (
            <div
              key={salle.id}
              className="rounded-lg border border-border/60 bg-card p-4 space-y-3 group relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <DoorOpen className="h-4 w-4 text-primary" />
                  </div>
                  <h3 className="text-sm font-medium">{salle.nom}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => { setEditingSalle(salle); setDialogOpen(true); }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(salle.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {salle.adresse && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{salle.adresse}</span>
                </div>
              )}

              <div className="flex items-center gap-4">
                {salle.capacite && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {salle.capacite} places
                  </div>
                )}
                {salle.equipements && (
                  <span className="text-[11px] text-muted-foreground/60 truncate">
                    {salle.equipements}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination simple */}
      {totalCount > 25 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {Math.ceil(totalCount / 25)}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={page >= Math.ceil(totalCount / 25)}
            onClick={() => setPage(page + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSalle ? "Modifier la salle" : "Ajouter une salle"}</DialogTitle>
            <DialogDescription>
              {editingSalle
                ? "Modifiez les informations de la salle."
                : "Renseignez les informations de la nouvelle salle."}
            </DialogDescription>
          </DialogHeader>
          <SalleForm
            initial={editingSalle}
            onSuccess={() => {
              setDialogOpen(false);
              setEditingSalle(null);
              fetchData();
              toast({
                title: editingSalle ? "Salle modifiée" : "Salle créée",
                variant: "success",
              });
            }}
            onCancel={() => { setDialogOpen(false); setEditingSalle(null); }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
}

function SalleForm({
  initial,
  onSuccess,
  onCancel,
}: {
  initial: Salle | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string[] | undefined>>({});
  const [form, setForm] = React.useState<SalleInput>({
    nom: initial?.nom ?? "",
    adresse: initial?.adresse ?? "",
    capacite: initial?.capacite ?? undefined,
    equipements: initial?.equipements ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    const result = initial
      ? await updateSalle(initial.id, form)
      : await createSalle(form);

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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errors._form && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {(errors._form as string[]).join(", ")}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="nom" className="text-[13px]">
          Nom <span className="text-destructive">*</span>
        </Label>
        <Input
          id="nom"
          value={form.nom}
          onChange={(e) => setForm({ ...form, nom: e.target.value })}
          placeholder="Salle A1"
          className="h-9 text-[13px] border-border/60"
        />
        {errors.nom && <p className="text-xs text-destructive">{errors.nom[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="adresse" className="text-[13px]">Adresse</Label>
        <Input
          id="adresse"
          value={form.adresse ?? ""}
          onChange={(e) => setForm({ ...form, adresse: e.target.value })}
          placeholder="12 rue de la Formation, 75001 Paris"
          className="h-9 text-[13px] border-border/60"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="capacite" className="text-[13px]">Capacité</Label>
          <Input
            id="capacite"
            type="number"
            min="0"
            value={form.capacite ?? ""}
            onChange={(e) => setForm({ ...form, capacite: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="20"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="equipements" className="text-[13px]">Équipements</Label>
          <Input
            id="equipements"
            value={form.equipements ?? ""}
            onChange={(e) => setForm({ ...form, equipements: e.target.value })}
            placeholder="Vidéoprojecteur, Tableau blanc"
            className="h-9 text-[13px] border-border/60"
          />
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-8 text-xs border-border/60">
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="h-8 text-xs">
          {isSubmitting ? (
            <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />{initial ? "Modification..." : "Création..."}</>
          ) : (
            initial ? "Modifier" : "Créer la salle"
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}
