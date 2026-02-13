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
    <div className="bg-[#f0f0f0] rounded-xl p-4">
      {/* A4 page container */}
      <div className="bg-white shadow-xl mx-auto overflow-hidden" style={{ aspectRatio: "210 / 297", maxWidth: "520px" }}>
        <div className="h-full flex flex-col text-[10px] leading-relaxed text-gray-800">
          {/* Orange top bar */}
          <div className="h-1.5 bg-[#F97316] shrink-0" />

          {/* Content area with padding */}
          <div className="flex-1 px-7 pt-5 pb-4 flex flex-col min-h-0">
            {/* Header: emetteur left + doc type right */}
            <div className="flex justify-between items-start mb-5">
              <div className="max-w-[55%]">
                {emetteur?.logo_url && (
                  <div className="mb-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={emetteur.logo_url}
                      alt={emetteur.nom || "Logo"}
                      className="h-8 max-w-[120px] object-contain"
                    />
                  </div>
                )}
                {emetteur && (
                  <div className="space-y-px">
                    <p className="font-bold text-[11px] text-[#F97316]">{emetteur.nom}</p>
                    {emetteur.siret && <p className="text-gray-500">SIRET : {emetteur.siret}</p>}
                    {emetteur.nda && <p className="text-gray-500">NDA : {emetteur.nda}</p>}
                    {emetteur.tva_intra && <p className="text-gray-500">TVA : {emetteur.tva_intra}</p>}
                    {emetteur.adresse && <p className="text-gray-500">{emetteur.adresse}</p>}
                    {(emetteur.email || emetteur.telephone) && (
                      <p className="text-gray-500">{[emetteur.email, emetteur.telephone].filter(Boolean).join(" — ")}</p>
                    )}
                  </div>
                )}
              </div>
              <div className="text-right">
                <p className="font-bold text-[15px] text-[#F97316] tracking-tight">{title}</p>
                <p className="text-gray-500 mt-0.5">N° {numero || "---"}</p>
                <div className="mt-2 space-y-0.5">
                  <p><span className="text-gray-400">Date :</span> {dateEmission || "---"}</p>
                  {dateEcheance && (
                    <p><span className="text-gray-400">Échéance :</span> {dateEcheance}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Destinataire */}
            {destinataire && (
              <div className="mb-4 border border-gray-200 rounded-md p-3 bg-gray-50/70">
                <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-1">Destinataire</p>
                <p className="font-semibold text-[11px]">{destinataire.nom}</p>
                {destinataire.adresse && <p className="text-gray-600 mt-0.5">{destinataire.adresse}</p>}
                {destinataire.siret && <p className="text-gray-500">SIRET : {destinataire.siret}</p>}
                {destinataire.email && <p className="text-gray-500">{destinataire.email}</p>}
              </div>
            )}

            {/* Objet */}
            {objet && (
              <div className="mb-3">
                <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Objet</p>
                <p className="text-gray-700">{objet}</p>
              </div>
            )}

            {/* Formation info */}
            {formationInfo && (
              <div className="mb-4 border border-orange-200/60 rounded-md p-3 bg-orange-50/30">
                <p className="text-[8px] text-[#F97316] uppercase font-semibold tracking-wider mb-1.5">Formation</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {formationInfo.nom && (
                    <p className="col-span-2 font-medium text-gray-800 mb-0.5">{formationInfo.nom}</p>
                  )}
                  {formationInfo.dates && (
                    <p><span className="text-gray-400">Dates :</span> <span className="text-gray-700">{formationInfo.dates}</span></p>
                  )}
                  {formationInfo.lieu && (
                    <p><span className="text-gray-400">Lieu :</span> <span className="text-gray-700">{formationInfo.lieu}</span></p>
                  )}
                  {formationInfo.modalite && (
                    <p><span className="text-gray-400">Modalité :</span> <span className="text-gray-700 capitalize">{formationInfo.modalite}</span></p>
                  )}
                  {formationInfo.duree && (
                    <p><span className="text-gray-400">Durée :</span> <span className="text-gray-700">{formationInfo.duree}</span></p>
                  )}
                  {formationInfo.participantsPrevus != null && (
                    <p><span className="text-gray-400">Participants :</span> <span className="text-gray-700">{formationInfo.participantsPrevus}</span></p>
                  )}
                </div>
              </div>
            )}

            {/* Participants presents */}
            {participantsPresents && participantsPresents.length > 0 && (
              <div className="mb-3">
                <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-1">
                  Participants présents ({participantsPresents.length})
                </p>
                <div className="space-y-px">
                  {participantsPresents.map((p, i) => (
                    <p key={i}>
                      <span className="text-gray-400 inline-block w-4">{i + 1}.</span>
                      <span className="font-medium">{p.nom.toUpperCase()} {p.prenom}</span>
                      {p.dates_presence.length > 0 && (
                        <span className="text-gray-400 ml-1.5">
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

            {/* Detail table */}
            <div className="mb-4">
              <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-1.5">Détail</p>
              <table className="w-full text-[9px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left py-1.5 px-2 font-semibold text-gray-600 rounded-l">Désignation</th>
                    <th className="text-right py-1.5 px-1.5 font-semibold text-gray-600 w-10">Qté</th>
                    <th className="text-right py-1.5 px-1.5 font-semibold text-gray-600 w-16">P.U. HT</th>
                    <th className="text-right py-1.5 px-1.5 font-semibold text-gray-600 w-10">TVA</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-gray-600 w-16 rounded-r">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((l, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="py-1.5 px-2">
                        <p className="font-medium text-gray-800 whitespace-pre-line">{l.designation || "..."}</p>
                        {l.description && (
                          <p className="text-gray-400 text-[8px] mt-0.5">{l.description}</p>
                        )}
                      </td>
                      <td className="text-right py-1.5 px-1.5 text-gray-600">{l.quantite}</td>
                      <td className="text-right py-1.5 px-1.5 text-gray-600">{formatCurrency(l.prix_unitaire_ht)}</td>
                      <td className="text-right py-1.5 px-1.5 text-gray-500">{l.taux_tva}%</td>
                      <td className="text-right py-1.5 px-2 font-medium text-gray-800">
                        {formatCurrency(l.quantite * l.prix_unitaire_ht)}
                      </td>
                    </tr>
                  ))}
                  {lignes.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-gray-300">
                        Aucune ligne
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-5">
              <div className="w-44 space-y-1">
                <div className="flex justify-between text-gray-600">
                  <span>Total HT</span>
                  <span className="font-medium text-gray-800">{formatCurrency(totalHT)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>TVA</span>
                  {exonerationTva ? (
                    <span className="text-[8px] text-gray-400 italic">Exonéré (art. 261-4-4°a CGI)</span>
                  ) : (
                    <span className="text-gray-800">{formatCurrency(totalTVA)}</span>
                  )}
                </div>
                <div className="flex justify-between border border-[#F97316]/30 bg-orange-50 rounded px-2 py-1.5 font-bold text-[11px]">
                  <span className="text-[#F97316]">Total TTC</span>
                  <span className="text-[#F97316]">{formatCurrency(totalTTC)}</span>
                </div>
              </div>
            </div>

            {/* Signature area (devis only) */}
            {type === "devis" && (
              <div className="mb-4">
                <p className="text-[9px] font-semibold text-gray-700 mb-1">Bon pour accord — Date et signature du client :</p>
                <div className="border border-dashed border-gray-300 rounded h-14 flex items-center justify-center">
                  <span className="text-[8px] text-gray-300 italic">Signature</span>
                </div>
              </div>
            )}

            {/* Spacer to push footer down */}
            <div className="flex-1" />

            {/* Conditions & bank details */}
            {(conditions || coordonneesBancaires) && (
              <div className="mb-3 space-y-2">
                {conditions && (
                  <div>
                    <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Conditions</p>
                    <p className="text-gray-500 whitespace-pre-line text-[9px]">{conditions}</p>
                  </div>
                )}
                {coordonneesBancaires && (
                  <div>
                    <p className="text-[8px] text-gray-400 uppercase font-semibold tracking-wider mb-0.5">Coordonnées bancaires</p>
                    <p className="text-gray-500 whitespace-pre-line text-[9px]">{coordonneesBancaires}</p>
                  </div>
                )}
              </div>
            )}

            {/* Mentions légales */}
            {mentionsLegales && (
              <div className="border-t border-gray-200 pt-2 mt-auto">
                <p className="text-[8px] text-gray-400 whitespace-pre-line leading-tight">{mentionsLegales}</p>
              </div>
            )}

            {/* Footer line */}
            {emetteur && (
              <div className="border-t border-gray-100 pt-1.5 mt-2 text-center">
                <p className="text-[7px] text-gray-400">
                  {[emetteur.nom, emetteur.nda ? `NDA : ${emetteur.nda}` : null, emetteur.siret ? `SIRET : ${emetteur.siret}` : null].filter(Boolean).join(" — ")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
