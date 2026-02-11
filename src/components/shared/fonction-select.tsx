"use client";

import * as React from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getFonctions,
  createFonction,
  updateFonction,
  deleteFonction,
  type FonctionPredefinie,
} from "@/actions/fonctions";

interface FonctionSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FonctionSelect({
  value,
  onChange,
  placeholder = "Sélectionner une fonction",
  className,
}: FonctionSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [fonctions, setFonctions] = React.useState<FonctionPredefinie[]>([]);
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isAdding, setIsAdding] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load fonctions on first open
  React.useEffect(() => {
    if (open && !isLoaded) {
      getFonctions().then((data) => {
        setFonctions(data);
        setIsLoaded(true);
      });
    }
  }, [open, isLoaded]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setIsAdding(false);
        setEditingId(null);
        setError(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = fonctions.filter((f) =>
    f.nom.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (nom: string) => {
    onChange(nom);
    setOpen(false);
    setSearch("");
    setIsAdding(false);
    setEditingId(null);
    setError(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setError(null);
    const result = await createFonction(newName.trim());
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.data) {
      setFonctions((prev) => [...prev, result.data!]);
      handleSelect(result.data.nom);
      setNewName("");
      setIsAdding(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    setError(null);
    const result = await updateFonction(id, editName.trim());
    if (result.error) {
      setError(result.error);
      return;
    }
    // If the edited item was the selected value, update it
    const oldFonction = fonctions.find((f) => f.id === id);
    if (oldFonction && value === oldFonction.nom) {
      onChange(editName.trim());
    }
    setFonctions((prev) =>
      prev.map((f) => (f.id === id ? { ...f, nom: editName.trim() } : f))
    );
    setEditingId(null);
    setEditName("");
  };

  const handleDelete = async (id: string) => {
    setError(null);
    const result = await deleteFonction(id);
    if (result.error) {
      setError(result.error);
      return;
    }
    const deleted = fonctions.find((f) => f.id === id);
    if (deleted && value === deleted.nom) {
      onChange("");
    }
    setFonctions((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-border/60 bg-muted px-3 py-1 text-sm shadow-sm transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          !value && "text-muted-foreground/50"
        )}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-border/40">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="h-7 text-xs border-border/40"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-2 py-1.5 text-xs text-destructive bg-destructive/10">
              {error}
            </div>
          )}

          {/* Options */}
          <div className="max-h-48 overflow-y-auto p-1">
            {/* Clear option */}
            {value && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="h-3 w-3" />
                Effacer la sélection
              </button>
            )}

            {filtered.length === 0 && !isAdding && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground/50">
                Aucune fonction trouvée
              </p>
            )}

            {filtered.map((f) => (
              <div key={f.id} className="group flex items-center gap-1">
                {editingId === f.id ? (
                  <div className="flex flex-1 items-center gap-1 p-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleUpdate(f.id); }
                        if (e.key === "Escape") { setEditingId(null); setError(null); }
                      }}
                      className="h-6 text-xs flex-1 border-border/40"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdate(f.id)}
                      className="p-1 rounded hover:bg-emerald-500/10 text-emerald-500"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingId(null); setError(null); }}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelect(f.nom)}
                      className={cn(
                        "flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-muted/50",
                        value === f.nom && "bg-primary/10 text-primary"
                      )}
                    >
                      {value === f.nom && <Check className="h-3 w-3 shrink-0" />}
                      <span className={cn(value !== f.nom && "ml-5")}>{f.nom}</span>
                    </button>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pr-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(f.id);
                          setEditName(f.nom);
                          setError(null);
                        }}
                        className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-foreground"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(f.id);
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div className="border-t border-border/40 p-2">
            {isAdding ? (
              <div className="flex items-center gap-1">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
                    if (e.key === "Escape") { setIsAdding(false); setNewName(""); setError(null); }
                  }}
                  placeholder="Nouvelle fonction..."
                  className="h-7 text-xs flex-1 border-border/40"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAdd}
                  disabled={!newName.trim()}
                  className="h-7 text-xs px-2"
                >
                  Ajouter
                </Button>
                <button
                  type="button"
                  onClick={() => { setIsAdding(false); setNewName(""); setError(null); }}
                  className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setIsAdding(true); setError(null); }}
                className="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                <Plus className="h-3 w-3" />
                Ajouter une fonction
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
