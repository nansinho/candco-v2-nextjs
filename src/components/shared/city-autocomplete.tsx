"use client";

import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CityResult {
  nom: string;
  code: string;
  codesPostaux: string[];
  departement: string;
}

interface CityAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect?: (result: { ville: string; cp: string }) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function CityAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Rechercher une ville...",
  className,
  id,
  name,
}: CityAutocompleteProps) {
  const [query, setQuery] = React.useState(value ?? "");
  const [results, setResults] = React.useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchCities = async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,code,codesPostaux,departement&boost=population&limit=8`
      );

      if (!response.ok) throw new Error("Erreur recherche");

      const data = await response.json();

      if (data && data.length > 0) {
        const mapped: CityResult[] = data.map(
          (c: { nom: string; code: string; codesPostaux: string[]; departement?: { nom: string; code: string } }) => ({
            nom: c.nom,
            code: c.code,
            codesPostaux: c.codesPostaux ?? [],
            departement: c.departement?.nom ?? "",
          })
        );
        setResults(mapped);
        setShowResults(true);
      } else {
        setResults([]);
        setShowResults(true);
      }
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange?.(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchCities(val);
    }, 300);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          id={id}
          name={name}
          value={query}
          onChange={handleChange}
          onFocus={() => {
            if (results.length > 0) setShowResults(true);
          }}
          placeholder={placeholder}
          className="h-9 pl-9 text-sm border-border/60"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/50" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-card shadow-lg max-h-48 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.code}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0"
              onClick={() => {
                const cp = r.codesPostaux[0] ?? "";
                onSelect?.({ ville: r.nom, cp });
                setQuery(r.nom);
                setShowResults(false);
                onChange?.(r.nom);
              }}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{r.nom}</span>
                  {r.codesPostaux.length > 0 && (
                    <span className="ml-2 text-xs text-muted-foreground/50">
                      {r.codesPostaux.slice(0, 2).join(", ")}
                    </span>
                  )}
                </div>
                {r.departement && (
                  <span className="text-xs text-muted-foreground/40 shrink-0">
                    {r.departement}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
