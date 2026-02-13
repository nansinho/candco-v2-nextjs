"use client";

import * as React from "react";
import { Download, Loader2, FileSpreadsheet, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/components/ui/toast";
import { getExportComptableData } from "@/actions/export-comptable";
import { entriesToCSV, type FECEntry } from "@/lib/fec-utils";
import { formatCurrency } from "@/lib/utils";

export default function ExportComptablePage() {
  const { toast } = useToast();
  const [dateDebut, setDateDebut] = React.useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [dateFin, setDateFin] = React.useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [isExporting, setIsExporting] = React.useState(false);
  const [preview, setPreview] = React.useState<FECEntry[] | null>(null);
  const [stats, setStats] = React.useState<{
    totalEntries: number;
    totalDebit: number;
    totalCredit: number;
  } | null>(null);

  const handlePreview = async () => {
    setIsExporting(true);
    const result = await getExportComptableData(dateDebut, dateFin);
    if (result.error) {
      toast({ title: "Erreur", description: result.error, variant: "destructive" });
      setIsExporting(false);
      return;
    }

    const entries = result.data;
    const totalDebit = entries.reduce(
      (sum, e) => sum + parseFloat(e.Debit.replace(",", ".") || "0"),
      0,
    );
    const totalCredit = entries.reduce(
      (sum, e) => sum + parseFloat(e.Credit.replace(",", ".") || "0"),
      0,
    );

    setPreview(entries);
    setStats({
      totalEntries: entries.length,
      totalDebit,
      totalCredit,
    });
    setIsExporting(false);
  };

  const handleExport = () => {
    if (!preview) return;

    const csv = entriesToCSV(preview);
    const blob = new Blob([csv], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FEC_${dateDebut}_${dateFin}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export réussi",
      description: `${preview.length} écritures exportées au format FEC.`,
      variant: "success",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export comptable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Exportez vos écritures comptables au format FEC pour votre cabinet comptable
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border/60 bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Date de début</Label>
            <DatePicker value={dateDebut} onChange={setDateDebut} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Date de fin</Label>
            <DatePicker value={dateFin} onChange={setDateFin} />
          </div>
          <Button
            size="sm"
            onClick={handlePreview}
            disabled={isExporting || !dateDebut || !dateFin}
            className="h-9 text-xs"
          >
            {isExporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
            )}
            Générer l'aperçu
          </Button>
          {preview && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="h-9 text-xs border-border/60"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Télécharger FEC (.txt)
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Écritures</p>
            <p className="text-2xl font-semibold">{stats.totalEntries}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Débit</p>
            <p className="text-2xl font-semibold">{formatCurrency(stats.totalDebit)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Crédit</p>
            <p className="text-2xl font-semibold">{formatCurrency(stats.totalCredit)}</p>
          </div>
        </div>
      )}

      {/* Preview table */}
      {preview && preview.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">
                Aperçu FEC ({preview.length} lignes)
              </h2>
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border/40">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Journal</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">N°</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Compte</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Libellé</th>
                  <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Pièce</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Débit</th>
                  <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">Crédit</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 200).map((entry, i) => (
                  <tr key={i} className="border-b border-border/20 hover:bg-muted/30">
                    <td className="px-2 py-1">{entry.JournalCode}</td>
                    <td className="px-2 py-1 font-mono">{entry.EcritureNum}</td>
                    <td className="px-2 py-1">{entry.EcritureDate}</td>
                    <td className="px-2 py-1 font-mono">{entry.CompteNum}</td>
                    <td className="px-2 py-1 max-w-[200px] truncate">{entry.EcritureLib}</td>
                    <td className="px-2 py-1">{entry.PieceRef}</td>
                    <td className="px-2 py-1 text-right font-mono">
                      {entry.Debit !== "0,00" ? entry.Debit : ""}
                    </td>
                    <td className="px-2 py-1 text-right font-mono">
                      {entry.Credit !== "0,00" ? entry.Credit : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 200 && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                Affichage limité à 200 lignes. L'export contiendra les {preview.length} lignes.
              </div>
            )}
          </div>
        </div>
      )}

      {preview && preview.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-16">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground-subtle" />
          <p className="mt-3 text-sm text-muted-foreground">
            Aucune écriture comptable pour la période sélectionnée
          </p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Vérifiez que des factures envoyées ou payées existent sur cette période.
          </p>
        </div>
      )}
    </div>
  );
}
