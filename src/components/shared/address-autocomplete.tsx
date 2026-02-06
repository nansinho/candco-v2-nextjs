"use client";

import * as React from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface AddressResult {
  label: string;
  rue: string;
  cp: string;
  ville: string;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Saisissez une adresse...",
  className,
  id,
  name,
}: AddressAutocompleteProps) {
  const [query, setQuery] = React.useState(value ?? "");
  const [results, setResults] = React.useState<AddressResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync with external value
  React.useEffect(() => {
    if (value !== undefined) {
      setQuery(value);
    }
  }, [value]);

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchAddress = async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`
      );

      if (!response.ok) throw new Error("Erreur recherche");

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const mapped: AddressResult[] = data.features.map(
          (f: { properties: Record<string, string> }) => ({
            label: f.properties.label ?? "",
            rue: f.properties.name ?? "",
            cp: f.properties.postcode ?? "",
            ville: f.properties.city ?? "",
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

    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchAddress(val);
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
          className="h-9 pl-9 text-[13px] border-border/60"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground/50" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/60 bg-card shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={`${r.label}-${i}`}
              type="button"
              className="w-full px-4 py-2 text-left hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0"
              onClick={() => {
                onSelect(r);
                setQuery(r.rue);
                setShowResults(false);
                onChange?.(r.rue);
              }}
            >
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                <p className="text-[13px] truncate">{r.label}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
