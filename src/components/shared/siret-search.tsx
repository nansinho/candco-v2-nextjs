"use client";

import * as React from "react";
import { Search, Building2, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  const handleSearch = async () => {
    if (!query.trim() || query.trim().length < 3) return;
    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      const cleanQuery = query.replace(/\s/g, "");
      // Determine if it's a SIRET/SIREN number or a company name
      const isNumber = /^\d+$/.test(cleanQuery);

      let url: string;
      if (isNumber && cleanQuery.length >= 9) {
        // Search by SIREN (9 digits) or SIRET (14 digits)
        if (cleanQuery.length === 14) {
          url = `https://api.insee.fr/api-sirene/3.11/siret/${cleanQuery}`;
        } else if (cleanQuery.length === 9) {
          url = `https://api.insee.fr/api-sirene/3.11/siren/${cleanQuery}`;
        } else {
          url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=5`;
        }
      } else {
        // Search by name using the free API
        url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=5`;
      }

      // Use the free recherche-entreprises API (no key required)
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(query)}&per_page=8`
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher par SIRET, SIREN ou nom..."
            className="h-9 pl-9 text-[13px] border-border/60"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSearch}
          disabled={isSearching || query.trim().length < 3}
          className="h-9 text-xs border-border/60"
        >
          {isSearching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Rechercher"
          )}
        </Button>
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
                    <p className="text-[13px] font-medium truncate">{r.nom}</p>
                    <p className="text-[11px] text-muted-foreground">
                      SIRET: {r.siret || r.siren} {r.adresse_cp && `— ${r.adresse_cp} ${r.adresse_ville}`}
                    </p>
                  </div>
                  <Check className="h-3.5 w-3.5 text-primary/0 group-hover:text-primary ml-auto shrink-0 mt-1" />
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
