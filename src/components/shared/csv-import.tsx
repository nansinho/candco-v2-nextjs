"use client";

import * as React from "react";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CsvImportColumn {
  key: string;
  label: string;
  required?: boolean;
}

interface CsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: CsvImportColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>;
  templateFilename: string;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === "," || char === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

export function CsvImport({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  templateFilename,
}: CsvImportProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Record<string, string>[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ success: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
    setParseError(null);
    setIsImporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setResult(null);
    setParseError(null);

    try {
      const text = await f.text();
      const { headers, rows } = parseCsv(text);

      if (headers.length === 0) {
        setParseError("Fichier vide ou format invalide.");
        return;
      }

      // Map headers to column keys (case-insensitive)
      const headerMap: Record<number, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        const matched = columns.find(
          (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h
        );
        if (matched) {
          headerMap[i] = matched.key;
        }
      }

      if (Object.keys(headerMap).length === 0) {
        setParseError(
          `Aucune colonne reconnue. Colonnes attendues: ${columns.map((c) => c.label).join(", ")}`
        );
        return;
      }

      // Parse rows
      const mapped = rows
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row) => {
          const obj: Record<string, string> = {};
          for (const [idx, key] of Object.entries(headerMap)) {
            obj[key] = row[Number(idx)] ?? "";
          }
          return obj;
        });

      setPreview(mapped.slice(0, 5));

      // Check required fields
      const requiredCols = columns.filter((c) => c.required);
      const missingRequired = requiredCols.filter(
        (c) => !Object.values(headerMap).includes(c.key)
      );

      if (missingRequired.length > 0) {
        setParseError(
          `Colonnes requises manquantes: ${missingRequired.map((c) => c.label).join(", ")}`
        );
        return;
      }
    } catch {
      setParseError("Erreur lors de la lecture du fichier.");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const { headers, rows } = parseCsv(text);

      // Map headers
      const headerMap: Record<number, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const h = headers[i].toLowerCase().trim();
        const matched = columns.find(
          (c) => c.label.toLowerCase() === h || c.key.toLowerCase() === h
        );
        if (matched) headerMap[i] = matched.key;
      }

      const mapped = rows
        .filter((row) => row.some((cell) => cell.trim()))
        .map((row) => {
          const obj: Record<string, string> = {};
          for (const [idx, key] of Object.entries(headerMap)) {
            obj[key] = row[Number(idx)] ?? "";
          }
          return obj;
        });

      const importResult = await onImport(mapped);
      setResult(importResult);
    } catch {
      setResult({ success: 0, errors: ["Erreur lors de l'import."] });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const BOM = "\uFEFF";
    const headers = columns.map((c) => c.label).join(";");
    const exampleRow = columns.map((c) => (c.required ? "Requis" : "")).join(";");
    const csvContent = `${BOM}${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${templateFilename}-template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template download */}
          <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 border border-border/30">
            <FileText className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <span className="text-xs text-muted-foreground flex-1">
              Colonnes attendues: {columns.map((c) => `${c.label}${c.required ? "*" : ""}`).join(", ")}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownloadTemplate}
              className="h-7 text-[11px] text-primary"
            >
              Template CSV
            </Button>
          </div>

          {/* File input */}
          <div className="flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-20 border-dashed border-2 border-border/40 hover:border-primary/30"
            >
              <div className="flex flex-col items-center gap-1">
                <Upload className="h-5 w-5 text-muted-foreground/60" />
                <span className="text-xs text-muted-foreground">
                  {file ? file.name : "Cliquez pour choisir un fichier CSV"}
                </span>
              </div>
            </Button>
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{parseError}</p>
            </div>
          )}

          {/* Preview */}
          {preview.length > 0 && !parseError && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Apercu ({preview.length} premières lignes):
              </p>
              <div className="overflow-x-auto rounded-md border border-border/40">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-muted/20">
                      {columns
                        .filter((c) => Object.values(preview[0] ?? {}).some((_, i) => columns[i]))
                        .map((c) => (
                          <th key={c.key} className="px-2 py-1.5 text-left font-medium text-muted-foreground/60">
                            {c.label}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-border/30">
                        {columns.map((c) => (
                          <td key={c.key} className="px-2 py-1 truncate max-w-[120px]">
                            {row[c.key] || <span className="text-muted-foreground/30">--</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import result */}
          {result && (
            <div className="space-y-2">
              {result.success > 0 && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-xs text-emerald-400">
                    {result.success} élément(s) importé(s) avec succès.
                  </p>
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="space-y-1 rounded-md bg-destructive/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">
                      {result.errors.length} erreur(s):
                    </p>
                  </div>
                  <ul className="text-[11px] text-destructive/80 space-y-0.5 ml-6">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>... et {result.errors.length - 5} autre(s)</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="h-8 text-xs border-border/60"
          >
            {result ? "Fermer" : "Annuler"}
          </Button>
          {!result && (
            <Button
              type="button"
              size="sm"
              onClick={handleImport}
              disabled={!file || !!parseError || isImporting}
              className="h-8 text-xs"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                  Import en cours...
                </>
              ) : (
                "Importer"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
