"use client";

import * as React from "react";
import { Search, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SiretResult {
  siren: string;
  siret: string;
  nom: string;
  adresse_rue: string;
  adresse_cp: string;
  adresse_ville: string;
  naf: string;
  tranche_effectif: string;
}

interface SiretSearchProps {
  onSelect: (result: SiretResult) => void;
  className?: string;
}

export function SiretSearch({ onSelect, className }: SiretSearchProps) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SiretResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const doSearch = React.useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(searchQuery)}&per_page=8`
      );

      if (!response.ok) {
        throw new Error("Erreur lors de la recherche");
      }

      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const mapped: SiretResult[] = data.results.map((r: Record<string, unknown>) => {
          const siege = r.siege as Record<string, string> | undefined;
          return {
            siren: (r.siren as string) ?? "",
            siret: siege?.siret ?? "",
            nom: (r.nom_complet as string) ?? (r.nom_raison_sociale as string) ?? "",
            adresse_rue: siege?.numero_voie
              ? `${siege.numero_voie} ${siege.type_voie ?? ""} ${siege.libelle_voie ?? ""}`.trim()
              : `${siege?.type_voie ?? ""} ${siege?.libelle_voie ?? ""}`.trim(),
            adresse_cp: siege?.code_postal ?? "",
            adresse_ville: siege?.libelle_commune ?? "",
            naf: (siege?.activite_principale as string) ?? "",
            tranche_effectif: (r.tranche_effectif_salarie as string) ?? "",
          };
        });

        setResults(mapped);
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(true);
      }
    } catch {
      setError("Erreur lors de la recherche. Vérifiez votre connexion.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    // Debounce search — auto-search as user types
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Immediate search on Enter
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder="Rechercher par SIRET, SIREN ou nom..."
          className="h-9 pl-9 text-sm border-border/60"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/50" />
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {showResults && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-card shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs text-muted-foreground/60">
              Aucun résultat trouvé.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.siret}-${i}`}
                type="button"
                className="w-full px-4 py-2.5 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0"
                onClick={() => {
                  onSelect(r);
                  setShowResults(false);
                  setQuery(r.nom);
                }}
              >
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      SIRET: {r.siret || r.siren} {r.adresse_cp && `— ${r.adresse_cp} ${r.adresse_ville}`}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
