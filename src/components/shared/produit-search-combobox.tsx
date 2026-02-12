"use client";

import * as React from "react";
import { Search, X, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { searchProduitsForDevis, type ProduitSearchResult } from "@/actions/produits";

interface ProduitSearchComboboxProps {
  value: ProduitSearchResult | null;
  onChange: (product: ProduitSearchResult | null) => void;
  disabled?: boolean;
}

const MODALITE_LABELS: Record<string, string> = {
  presentiel: "Présentiel",
  distanciel: "Distanciel",
  mixte: "Mixte",
  afest: "AFEST",
};

export function ProduitSearchCombobox({ value, onChange, disabled }: ProduitSearchComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ProduitSearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = React.useCallback(async (q: string) => {
    setLoading(true);
    try {
      const data = await searchProduitsForDevis(q);
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

  const handleSelect = (product: ProduitSearchResult) => {
    onChange(product);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
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
          {value ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <BookOpen className="h-3.5 w-3.5 text-orange-400 shrink-0" />
              <span className="truncate">{value.intitule}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Choisir un programme...</span>
          )}
          {value && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClear(e as unknown as React.MouseEvent); }}
              className="ml-1 shrink-0 rounded-full p-0.5 hover:bg-muted"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </span>
          ) : (
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-2 border-b border-border/40">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Rechercher par nom, code, pôle..."
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
              Aucun programme trouvé
            </div>
          )}
          {results.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className="w-full text-left px-3 py-2.5 hover:bg-accent/50 transition-colors border-b border-border/20 last:border-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    {product.numero_affichage && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                        {product.numero_affichage}
                      </span>
                    )}
                    <span className="text-sm font-medium truncate">{product.intitule}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {product.domaine && (
                      <span className="text-[10px] text-muted-foreground">{product.domaine}</span>
                    )}
                    {product.categorie && product.categorie !== product.domaine && (
                      <>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground">{product.categorie}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {product.modalite && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-border/40">
                      {MODALITE_LABELS[product.modalite] || product.modalite}
                    </Badge>
                  )}
                  {product.duree_heures && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {product.duree_heures}h
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
