"use client";

import * as React from "react";
import { Search, Building2, Loader2, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { searchEntreprisesForDevis, type EntrepriseSearchResult } from "@/actions/devis";

interface EntrepriseSearchComboboxProps {
  value: string;
  displayName?: string;
  onChange: (id: string, entreprise?: EntrepriseSearchResult) => void;
  disabled?: boolean;
}

export function EntrepriseSearchCombobox({ value, displayName, onChange, disabled }: EntrepriseSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<EntrepriseSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedName, setSelectedName] = React.useState(displayName || "");
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  React.useEffect(() => {
    if (displayName) setSelectedName(displayName);
  }, [displayName]);

  const doSearch = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await searchEntreprisesForDevis(q);
      setResults(data);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      doSearch(query);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (entreprise: EntrepriseSearchResult) => {
    onChange(entreprise.id, entreprise);
    setSelectedName(entreprise.nom);
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    onChange("");
    setSelectedName("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between h-9 text-sm border-border/60 font-normal"
        >
          {value && selectedName ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Rechercher une entreprise...</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Rechercher par nom, SIRET..."
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Chargement...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Aucune entreprise trouvée
            </div>
          )}

          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:bg-accent/50 transition-colors border-b border-border/20"
            >
              -- Aucune entreprise --
            </button>
          )}

          {results.map((ent) => (
            <button
              key={ent.id}
              type="button"
              onClick={() => handleSelect(ent)}
              className={`w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors border-b border-border/20 last:border-0 ${
                ent.id === value ? "bg-accent/30" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {ent.numero_affichage && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {ent.numero_affichage}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">{ent.nom}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {ent.adresse_ville && (
                      <span className="text-[10px] text-muted-foreground">{ent.adresse_ville}</span>
                    )}
                    {ent.siret && (
                      <>
                        {ent.adresse_ville && <span className="text-[10px] text-muted-foreground/50">·</span>}
                        <span className="text-[10px] text-muted-foreground font-mono">{ent.siret}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
