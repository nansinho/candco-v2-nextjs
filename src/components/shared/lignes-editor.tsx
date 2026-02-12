"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

export interface LigneItem {
  id?: string;
  designation: string;
  description?: string;
  quantite: number;
  prix_unitaire_ht: number;
  taux_tva: number;
  montant_ht?: number;
  ordre: number;
}

interface LignesEditorProps {
  lignes: LigneItem[];
  onChange: (lignes: LigneItem[]) => void;
  readOnly?: boolean;
  tvaLocked?: boolean;
}

// ─── Main LignesEditor ──────────────────────────────────

export function LignesEditor({ lignes, onChange, readOnly = false, tvaLocked = false }: LignesEditorProps) {
  const addLigne = () => {
    onChange([
      ...lignes,
      {
        designation: "",
        description: "",
        quantite: 1,
        prix_unitaire_ht: 0,
        taux_tva: 0,
        ordre: lignes.length,
      },
    ]);
  };

  const updateLigne = (index: number, field: keyof LigneItem, value: string | number) => {
    const updated = [...lignes];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeLigne = (index: number) => {
    onChange(lignes.filter((_, i) => i !== index));
  };

  const totalHT = lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire_ht, 0);
  const totalTVA = lignes.reduce(
    (sum, l) => sum + l.quantite * l.prix_unitaire_ht * (l.taux_tva / 100),
    0,
  );
  const totalTTC = totalHT + totalTVA;

  return (
    <div className="space-y-3">
      {/* Header — desktop only */}
      <div className="hidden md:grid grid-cols-[1fr_80px_100px_70px_100px_36px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        <span>Désignation</span>
        <span className="text-right">Qté</span>
        <span className="text-right">P.U. HT</span>
        <span className="text-right">TVA %</span>
        <span className="text-right">Total HT</span>
        <span />
      </div>

      {/* Lines */}
      {lignes.map((ligne, index) => {
        const ligneHT = ligne.quantite * ligne.prix_unitaire_ht;
        return (
          <div key={index}>
            {/* Desktop layout */}
            <div className="hidden md:grid grid-cols-[1fr_80px_100px_70px_100px_36px] gap-2 items-start">
              <div className="space-y-1">
                <Input
                  value={ligne.designation}
                  onChange={(e) => updateLigne(index, "designation", e.target.value)}
                  placeholder="Désignation"
                  className="h-8 text-sm border-border/60"
                  readOnly={readOnly}
                />
                <Input
                  value={ligne.description}
                  onChange={(e) => updateLigne(index, "description", e.target.value)}
                  placeholder="Description (optionnel)"
                  className="h-7 text-xs text-muted-foreground border-border/40"
                  readOnly={readOnly}
                />
              </div>
              <Input
                type="number"
                value={ligne.quantite}
                onChange={(e) => updateLigne(index, "quantite", Number(e.target.value))}
                className="h-8 text-sm text-right border-border/60"
                min="0"
                step="0.01"
                readOnly={readOnly}
              />
              <Input
                type="number"
                value={ligne.prix_unitaire_ht}
                onChange={(e) => updateLigne(index, "prix_unitaire_ht", Number(e.target.value))}
                className="h-8 text-sm text-right border-border/60"
                min="0"
                step="0.01"
                readOnly={readOnly}
              />
              <Input
                type="number"
                value={ligne.taux_tva}
                onChange={(e) => updateLigne(index, "taux_tva", Number(e.target.value))}
                className={`h-8 text-sm text-right border-border/60${tvaLocked ? " opacity-50 cursor-not-allowed" : ""}`}
                min="0"
                step="0.01"
                readOnly={readOnly}
                disabled={tvaLocked}
              />
              <div className="flex h-8 items-center justify-end font-mono text-sm">
                {formatCurrency(ligneHT)}
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLigne(index)}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Mobile layout — card per line */}
            <div className="md:hidden rounded-lg border border-border/40 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Ligne {index + 1}
                </span>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLigne(index)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <Input
                value={ligne.designation}
                onChange={(e) => updateLigne(index, "designation", e.target.value)}
                placeholder="Désignation"
                className="h-8 text-sm border-border/60"
                readOnly={readOnly}
              />
              <Input
                value={ligne.description}
                onChange={(e) => updateLigne(index, "description", e.target.value)}
                placeholder="Description (optionnel)"
                className="h-7 text-xs text-muted-foreground border-border/40"
                readOnly={readOnly}
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Qté</label>
                  <Input
                    type="number"
                    value={ligne.quantite}
                    onChange={(e) => updateLigne(index, "quantite", Number(e.target.value))}
                    className="h-8 text-sm text-right border-border/60"
                    min="0"
                    step="0.01"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">P.U. HT</label>
                  <Input
                    type="number"
                    value={ligne.prix_unitaire_ht}
                    onChange={(e) => updateLigne(index, "prix_unitaire_ht", Number(e.target.value))}
                    className="h-8 text-sm text-right border-border/60"
                    min="0"
                    step="0.01"
                    readOnly={readOnly}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">TVA %</label>
                  <Input
                    type="number"
                    value={ligne.taux_tva}
                    onChange={(e) => updateLigne(index, "taux_tva", Number(e.target.value))}
                    className={`h-8 text-sm text-right border-border/60${tvaLocked ? " opacity-50 cursor-not-allowed" : ""}`}
                    min="0"
                    step="0.01"
                    readOnly={readOnly}
                    disabled={tvaLocked}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1 border-t border-border/30">
                <span className="text-xs text-muted-foreground mr-2">Total HT :</span>
                <span className="font-mono text-sm font-medium">{formatCurrency(ligneHT)}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Add button */}
      {!readOnly && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addLigne}
          className="h-8 text-xs border-dashed border-border/60"
        >
          <Plus className="mr-1 h-3 w-3" />
          Ligne libre
        </Button>
      )}

      {/* Totals */}
      <div className="border-t border-border/40 pt-3 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total HT</span>
          <span className="font-mono">{formatCurrency(totalHT)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TVA</span>
          <span className="font-mono">{formatCurrency(totalTVA)}</span>
        </div>
        <div className="flex justify-between text-sm font-semibold">
          <span>Total TTC</span>
          <span className="font-mono">{formatCurrency(totalTTC)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── PDF-like Preview ────────────────────────────────────

interface DocumentPreviewProps {
  type: "devis" | "facture" | "avoir";
  numero: string;
  dateEmission: string;
  dateEcheance?: string;
  objet?: string;
  destinataire?: {
    nom: string;
    adresse?: string;
    siret?: string;
    email?: string;
  };
  emetteur?: {
    nom: string;
    siret?: string;
    nda?: string;
    adresse?: string;
    email?: string;
    telephone?: string;
    tva_intra?: string;
    logo_url?: string;
  };
  lignes: LigneItem[];
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  conditions?: string;
  mentionsLegales?: string;
  coordonneesBancaires?: string;
  exonerationTva?: boolean;
  formationInfo?: {
    nom?: string;
    dates?: string;
    lieu?: string;
    modalite?: string;
    duree?: string;
    participantsPrevus?: number;
  };
  participantsPresents?: Array<{
    prenom: string;
    nom: string;
    dates_presence: string[];
  }>;
}

export function DocumentPreview({
  type,
  numero,
  dateEmission,
  dateEcheance,
  objet,
  destinataire,
  emetteur,
  lignes,
  totalHT,
  totalTVA,
  totalTTC,
  conditions,
  mentionsLegales,
  coordonneesBancaires,
  exonerationTva,
  formationInfo,
  participantsPresents,
}: DocumentPreviewProps) {
  const title = type === "devis" ? "DEVIS" : type === "facture" ? "FACTURE" : "AVOIR";

  return (
    <div className="rounded-lg border border-border/40 bg-white text-black p-6 text-xs leading-relaxed shadow-sm min-h-[600px]">
      {/* Header */}
      <div className="flex justify-between mb-6">
        <div>
          {emetteur?.logo_url && (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={emetteur.logo_url}
                alt={emetteur.nom || "Logo"}
                className="h-12 max-w-[160px] object-contain"
              />
            </div>
          )}
          {emetteur && (
            <>
              <p className="font-bold text-sm">{emetteur.nom}</p>
              {emetteur.siret && <p className="text-gray-600">SIRET : {emetteur.siret}</p>}
              {emetteur.nda && <p className="text-gray-600">NDA : {emetteur.nda}</p>}
              {emetteur.tva_intra && <p className="text-gray-600">TVA : {emetteur.tva_intra}</p>}
              {emetteur.adresse && <p className="text-gray-600">{emetteur.adresse}</p>}
              {emetteur.email && <p className="text-gray-600">{emetteur.email}</p>}
              {emetteur.telephone && <p className="text-gray-600">{emetteur.telephone}</p>}
            </>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-orange-600">{title}</p>
          <p className="text-gray-600">N° {numero || "---"}</p>
          <p className="text-gray-600">
            Date : {dateEmission || "---"}
          </p>
          {dateEcheance && (
            <p className="text-gray-600">Échéance : {dateEcheance}</p>
          )}
        </div>
      </div>

      {/* Destinataire */}
      {destinataire && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Destinataire</p>
          <p className="font-semibold">{destinataire.nom}</p>
          {destinataire.adresse && <p>{destinataire.adresse}</p>}
          {destinataire.siret && <p className="text-gray-600">SIRET : {destinataire.siret}</p>}
          {destinataire.email && <p className="text-gray-600">{destinataire.email}</p>}
        </div>
      )}

      {objet && (
        <div className="mb-4">
          <p className="font-semibold">Objet : {objet}</p>
        </div>
      )}

      {/* Formation info */}
      {formationInfo && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Formation</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {formationInfo.dates && (
              <p><span className="text-gray-500">Dates :</span> {formationInfo.dates}</p>
            )}
            {formationInfo.lieu && (
              <p><span className="text-gray-500">Lieu :</span> {formationInfo.lieu}</p>
            )}
            {formationInfo.modalite && (
              <p><span className="text-gray-500">Modalité :</span> <span className="capitalize">{formationInfo.modalite}</span></p>
            )}
            {formationInfo.duree && (
              <p><span className="text-gray-500">Durée :</span> {formationInfo.duree}</p>
            )}
            {formationInfo.participantsPrevus != null && (
              <p><span className="text-gray-500">Participants prévus :</span> {formationInfo.participantsPrevus}</p>
            )}
          </div>
        </div>
      )}

      {/* Participants presents */}
      {participantsPresents && participantsPresents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">
            Participants présents ({participantsPresents.length})
          </p>
          <div className="text-xs space-y-0.5">
            {participantsPresents.map((p, i) => (
              <p key={i}>
                <span className="text-gray-500 inline-block w-5">{i + 1}.</span>
                <span className="font-medium">{p.nom.toUpperCase()} {p.prenom}</span>
                {p.dates_presence.length > 0 && (
                  <span className="text-gray-500 ml-2">
                    ({p.dates_presence.map((d) => {
                      const parts = d.split("-");
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
                    }).join(", ")})
                  </span>
                )}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <table className="w-full mb-4 text-xs">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-left py-1.5 font-semibold">Désignation</th>
            <th className="text-right py-1.5 font-semibold w-16">Qté</th>
            <th className="text-right py-1.5 font-semibold w-20">P.U. HT</th>
            <th className="text-right py-1.5 font-semibold w-14">TVA</th>
            <th className="text-right py-1.5 font-semibold w-20">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5">
                <p className="font-medium">{l.designation || "..."}</p>
                {l.description && (
                  <p className="text-gray-500 text-xs">{l.description}</p>
                )}
              </td>
              <td className="text-right py-1.5">{l.quantite}</td>
              <td className="text-right py-1.5">{formatCurrency(l.prix_unitaire_ht)}</td>
              <td className="text-right py-1.5">{l.taux_tva}%</td>
              <td className="text-right py-1.5 font-medium">
                {formatCurrency(l.quantite * l.prix_unitaire_ht)}
              </td>
            </tr>
          ))}
          {lignes.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center py-8 text-gray-400">
                Aucune ligne
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-48 space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total HT</span>
            <span className="font-medium">{formatCurrency(totalHT)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">TVA</span>
            {exonerationTva ? (
              <span className="text-[10px] text-gray-500 italic">Exonéré (art. 261-4-4a CGI)</span>
            ) : (
              <span>{formatCurrency(totalTVA)}</span>
            )}
          </div>
          <div className="flex justify-between border-t border-gray-300 pt-1 font-bold">
            <span>Total TTC</span>
            <span>{formatCurrency(totalTTC)}</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      {conditions && (
        <div className="mb-3">
          <p className="font-semibold text-xs text-gray-500 uppercase">Conditions</p>
          <p className="text-gray-600 whitespace-pre-line">{conditions}</p>
        </div>
      )}
      {coordonneesBancaires && (
        <div className="mb-3">
          <p className="font-semibold text-xs text-gray-500 uppercase">Coordonnées bancaires</p>
          <p className="text-gray-600 whitespace-pre-line">{coordonneesBancaires}</p>
        </div>
      )}
      {mentionsLegales && (
        <div className="text-xs text-gray-400 border-t border-gray-200 pt-2 mt-4 whitespace-pre-line">
          {mentionsLegales}
        </div>
      )}
    </div>
  );
}
