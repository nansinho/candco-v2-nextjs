"use client";

import * as React from "react";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from "xlsx";

// ─── Types ───────────────────────────────────────────────

export interface ImportColumn {
  key: string;
  label: string;
  required?: boolean;
  /** Alias pour matcher des noms de colonnes SmartOF ou autres exports */
  aliases?: string[];
}

interface CsvImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  columns: ImportColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<{ success: number; errors: string[] }>;
  templateFilename: string;
  /** If provided, PDF files trigger AI import instead of CSV parsing */
  onPdfImport?: (file: File) => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────

/** Normalise un header pour la comparaison (minuscules, sans accents, sans espaces superflus) */
function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Supprime tous les espaces d'une chaîne normalisée (pour comparaison compacte) */
function compactHeader(h: string): string {
  return normalizeHeader(h).replace(/\s+/g, "");
}

/** Trouve la colonne correspondante à un header donné */
function matchColumn(header: string, columns: ImportColumn[]): ImportColumn | undefined {
  const normalized = normalizeHeader(header);

  // Pass 1 : match exact (avec espaces)
  for (const col of columns) {
    if (normalizeHeader(col.key) === normalized) return col;
    if (normalizeHeader(col.label) === normalized) return col;

    if (col.aliases) {
      for (const alias of col.aliases) {
        if (normalizeHeader(alias) === normalized) return col;
      }
    }
  }

  // Pass 2 : match compact (sans espaces) — résout les apostrophes françaises
  // Ex: "Nom de l'apprenant" → "nomdelapprenant" == "nomdelapprenant" ← alias "nom de lapprenant"
  const compact = compactHeader(header);
  for (const col of columns) {
    if (compactHeader(col.key) === compact) return col;
    if (compactHeader(col.label) === compact) return col;

    if (col.aliases) {
      for (const alias of col.aliases) {
        if (compactHeader(alias) === compact) return col;
      }
    }
  }

  return undefined;
}

/** Parse un fichier CSV en headers + rows */
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Retirer le BOM UTF-8
  const cleanText = text.replace(/^\uFEFF/, "");
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim());
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

/** Parse un fichier Excel (.xls/.xlsx) via SheetJS */
function parseExcel(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return { headers: [], rows: [] };

  const jsonData = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: "" });
  if (jsonData.length === 0) return { headers: [], rows: [] };

  const headers = (jsonData[0] as string[]).map((h) => String(h ?? "").trim());
  const rows = jsonData.slice(1).map((row) =>
    (row as string[]).map((cell) => String(cell ?? "").trim())
  );

  return { headers, rows };
}

/** Parse un fichier JSON (array d'objets) */
function parseJson(
  text: string,
  columns: ImportColumn[]
): { rows: Record<string, string>[]; headerMap: Record<number, string>; headers: string[]; error?: string } {
  let jsonData: unknown;
  try {
    jsonData = JSON.parse(text);
  } catch {
    return { rows: [], headerMap: {}, headers: [], error: "Fichier JSON invalide." };
  }

  if (!Array.isArray(jsonData) || jsonData.length === 0) {
    return { rows: [], headerMap: {}, headers: [], error: "Le fichier JSON est vide ou n'est pas un tableau." };
  }

  const headers = Object.keys(jsonData[0] as Record<string, unknown>);
  const headerMap: Record<number, string> = {};
  const matchedColumns = new Set<string>();

  headers.forEach((h, i) => {
    const matched = matchColumn(h, columns);
    if (matched && !matchedColumns.has(matched.key)) {
      headerMap[i] = matched.key;
      matchedColumns.add(matched.key);
    }
  });

  if (Object.keys(headerMap).length === 0) {
    const expected = columns.map((c) => c.label).join(", ");
    return { rows: [], headerMap: {}, headers, error: `Aucune colonne reconnue. Colonnes attendues : ${expected}` };
  }

  // Vérifier les colonnes requises
  const requiredMissing = columns
    .filter((c) => c.required && !matchedColumns.has(c.key))
    .map((c) => c.label);

  if (requiredMissing.length > 0) {
    return { rows: [], headerMap, headers, error: `Colonnes requises manquantes : ${requiredMissing.join(", ")}` };
  }

  const rows = (jsonData as Record<string, unknown>[]).map((obj) => {
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (headerMap[i] !== undefined) {
        const val = (obj as Record<string, unknown>)[h];
        row[headerMap[i]] = val != null ? String(val) : "";
      }
    });
    return row;
  });

  return { rows, headerMap, headers };
}

/** Parse un fichier (CSV, Excel ou JSON) et retourne des objets mappés */
async function parseFile(
  file: File,
  columns: ImportColumn[]
): Promise<{ rows: Record<string, string>[]; headerMap: Record<number, string>; headers: string[]; error?: string }> {
  // Détection JSON
  if (/\.json$/i.test(file.name)) {
    const text = await file.text();
    return parseJson(text, columns);
  }

  const isExcel = /\.(xls|xlsx)$/i.test(file.name);

  let headers: string[];
  let rawRows: string[][];

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const result = parseExcel(buffer);
    headers = result.headers;
    rawRows = result.rows;
  } else {
    const text = await file.text();
    const result = parseCsv(text);
    headers = result.headers;
    rawRows = result.rows;
  }

  if (headers.length === 0) {
    return { rows: [], headerMap: {}, headers: [], error: "Fichier vide ou format invalide." };
  }

  // Mapper les colonnes du fichier vers nos champs
  const headerMap: Record<number, string> = {};
  const matchedColumns = new Set<string>();

  for (let i = 0; i < headers.length; i++) {
    const matched = matchColumn(headers[i], columns);
    if (matched && !matchedColumns.has(matched.key)) {
      headerMap[i] = matched.key;
      matchedColumns.add(matched.key);
    }
  }

  if (Object.keys(headerMap).length === 0) {
    const expected = columns.map((c) => c.label).join(", ");
    return {
      rows: [],
      headerMap: {},
      headers,
      error: `Aucune colonne reconnue. Colonnes attendues : ${expected}`,
    };
  }

  // Vérifier les colonnes requises
  const requiredMissing = columns
    .filter((c) => c.required && !matchedColumns.has(c.key))
    .map((c) => c.label);

  if (requiredMissing.length > 0) {
    return {
      rows: [],
      headerMap,
      headers,
      error: `Colonnes requises manquantes : ${requiredMissing.join(", ")}`,
    };
  }

  // Mapper les lignes
  const rows = rawRows
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const obj: Record<string, string> = {};
      for (const [idx, key] of Object.entries(headerMap)) {
        obj[key] = row[Number(idx)] ?? "";
      }
      return obj;
    });

  return { rows, headerMap, headers };
}

// ─── Component ───────────────────────────────────────────

export function CsvImport({
  open,
  onOpenChange,
  title,
  description,
  columns,
  onImport,
  templateFilename,
  onPdfImport,
}: CsvImportProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = React.useState(0);
  const [matchedColumnsInfo, setMatchedColumnsInfo] = React.useState<string[]>([]);
  const [isImporting, setIsImporting] = React.useState(false);
  const [result, setResult] = React.useState<{ success: number; errors: string[] } | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [isPdfMode, setIsPdfMode] = React.useState(false);
  const [isPdfImporting, setIsPdfImporting] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setTotalRows(0);
    setMatchedColumnsInfo([]);
    setResult(null);
    setParseError(null);
    setIsImporting(false);
    setIsPdfMode(false);
    setIsPdfImporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Detect PDF → AI import
    if (/\.pdf$/i.test(f.name) && onPdfImport) {
      setFile(f);
      setIsPdfMode(true);
      setIsPdfImporting(true);
      setResult(null);
      setParseError(null);
      try {
        await onPdfImport(f);
      } catch {
        setParseError("Erreur lors de l'import IA du PDF.");
      } finally {
        setIsPdfImporting(false);
      }
      return;
    }

    setFile(f);
    setIsPdfMode(false);
    setResult(null);
    setParseError(null);

    try {
      const { rows, headerMap, error } = await parseFile(f, columns);

      if (error) {
        setParseError(error);
        return;
      }

      setTotalRows(rows.length);
      setPreview(rows.slice(0, 5));

      // Quelles colonnes ont été matchées
      const matched = Object.values(headerMap).map(
        (key) => columns.find((c) => c.key === key)?.label ?? key
      );
      setMatchedColumnsInfo(matched);
    } catch {
      setParseError("Erreur lors de la lecture du fichier.");
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setResult(null);

    try {
      const { rows, error } = await parseFile(file, columns);

      if (error) {
        setResult({ success: 0, errors: [error] });
        setIsImporting(false);
        return;
      }

      const importResult = await onImport(rows);
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

  const isExcel = file && /\.(xls|xlsx)$/i.test(file.name);
  const isJson = file && /\.json$/i.test(file.name);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-4 w-4 text-primary" />
            </div>
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sélection fichier */}
          <div className="flex flex-col items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xls,.xlsx,.json,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border/50 bg-muted/20 px-6 py-8 transition-all hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
            >
              <div className="flex flex-col items-center gap-2.5">
                {file ? (
                  <>
                    {isExcel ? (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                      </div>
                    ) : isJson ? (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/10">
                        <FileText className="h-5 w-5 text-amber-400" />
                      </div>
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/10">
                        <FileText className="h-5 w-5 text-blue-400" />
                      </div>
                    )}
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground/60">Cliquez pour changer</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/50">
                      <Upload className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Glissez ou cliquez pour choisir un fichier</p>
                      <p className="mt-1 text-xs text-muted-foreground/40">
                        CSV, Excel, JSON{onPdfImport ? ", PDF" : ""}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </button>
            <div className="flex w-full items-center justify-between px-1">
              <p className="text-xs text-muted-foreground/40">
                Colonnes SmartOF reconnues automatiquement
              </p>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-xs text-primary hover:underline"
              >
                Template CSV
              </button>
            </div>
          </div>

          {/* PDF AI Import in progress */}
          {isPdfMode && isPdfImporting && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyse IA du PDF en cours...</p>
              <p className="text-xs text-muted-foreground/60">
                Extraction de l&apos;intitule, description, duree, objectifs, programme, tarifs, modalites...
              </p>
            </div>
          )}

          {/* Erreur de parsing */}
          {parseError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{parseError}</p>
            </div>
          )}

          {/* Info colonnes matchées */}
          {matchedColumnsInfo.length > 0 && !parseError && (
            <div className="flex items-start gap-2 rounded-md bg-emerald-500/10 px-3 py-2 border border-emerald-500/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <div className="text-xs text-emerald-400">
                <p>
                  <strong>{totalRows}</strong> ligne(s) trouvée(s) &bull;{" "}
                  <strong>{matchedColumnsInfo.length}</strong>/{columns.length} colonnes reconnues
                </p>
                <p className="text-xs text-emerald-400/60 mt-0.5">
                  Colonnes : {matchedColumnsInfo.join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Aperçu */}
          {preview.length > 0 && !parseError && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Aperçu (5 premières lignes sur {totalRows}) :
              </p>
              <div className="overflow-x-auto rounded-md border border-border/40">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20">
                      {columns
                        .filter((c) => matchedColumnsInfo.includes(c.label))
                        .map((c) => (
                          <th key={c.key} className="px-2 py-1.5 text-left font-medium text-muted-foreground/60 whitespace-nowrap">
                            {c.label}
                            {c.required && <span className="text-destructive">*</span>}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t border-border/30">
                        {columns
                          .filter((c) => matchedColumnsInfo.includes(c.label))
                          .map((c) => (
                            <td key={c.key} className="px-2 py-1 truncate max-w-[200px]">
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

          {/* Résultat d'import */}
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
              {result.errors.length > 0 && (() => {
                const warnings = result.errors.filter((e) => e.includes("doublon") || e.includes("en doublon"));
                const errors = result.errors.filter((e) => !e.includes("doublon") && !e.includes("en doublon"));
                return (
                  <>
                    {warnings.length > 0 && (
                      <div className="space-y-1 rounded-md bg-amber-500/10 px-3 py-2 border border-amber-500/20">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-xs text-amber-400 font-medium">
                            {warnings.length} avertissement(s) :
                          </p>
                        </div>
                        <ul className="text-xs text-amber-400/80 space-y-0.5 ml-6 max-h-24 overflow-y-auto">
                          {warnings.slice(0, 10).map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                          {warnings.length > 10 && (
                            <li>... et {warnings.length - 10} autre(s)</li>
                          )}
                        </ul>
                      </div>
                    )}
                    {errors.length > 0 && (
                      <div className="space-y-1 rounded-md bg-destructive/10 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                          <p className="text-xs text-destructive font-medium">
                            {errors.length} erreur(s) :
                          </p>
                        </div>
                        <ul className="text-xs text-destructive/80 space-y-0.5 ml-6 max-h-24 overflow-y-auto">
                          {errors.slice(0, 10).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {errors.length > 10 && (
                            <li>... et {errors.length - 10} autre(s)</li>
                          )}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            className="h-9 text-sm border-border/60"
          >
            {result ? "Fermer" : "Annuler"}
          </Button>
          {!result && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={!file || !!parseError || isImporting || totalRows === 0}
              className="h-9 text-sm"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Import en cours...
                </>
              ) : (
                <>
                  Importer {totalRows > 0 && `(${totalRows})`}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
