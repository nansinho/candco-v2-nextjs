/**
 * Générateur PDF pour C&CO Formation v2
 *
 * Utilise pdf-lib pour générer des documents PDF côté serveur :
 * - Convention de formation
 * - Attestation de fin de formation
 * - Certificat de réalisation
 * - Convocation
 * - Feuille d'émargement
 * - Programme de formation
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
  PDFRawStream,
  PDFName,
} from "pdf-lib";
import { deflateSync } from "node:zlib";

// ─── PDF Compression ────────────────────────────────────

type PdfLibContext = {
  enumerateIndirectObjects(): [unknown, unknown][];
  assign(ref: unknown, obj: unknown): void;
};

function getContext(doc: PDFDocument): PdfLibContext | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = (doc as any).context as PdfLibContext | undefined;
  return ctx?.enumerateIndirectObjects ? ctx : null;
}

/**
 * Compress a PDF by deflating all uncompressed streams.
 *
 * Preserves the full document structure including digital signatures,
 * annotations, AcroForm, and all metadata.  Only compresses raw streams
 * that don't already carry a /Filter (FlateDecode, DCTDecode, etc.).
 *
 * This is safe to use on signed PDFs from Documenso — the signature
 * and its visual appearance are kept intact.
 */
export async function compressPdf(
  inputBytes: Uint8Array,
): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(inputBytes, {
      updateMetadata: false,
      ignoreEncryption: true,
    });
    const ctx = getContext(doc);
    if (!ctx) return inputBytes;

    let didCompress = false;

    for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFRawStream)) continue;

      const dict = obj.dict;
      const filter = dict.lookup(PDFName.of("Filter"));

      // Skip streams that already have a filter
      if (filter) continue;
      // Skip tiny streams
      if (obj.contents.length < 128) continue;

      try {
        const compressed = deflateSync(Buffer.from(obj.contents), { level: 9 });
        if (compressed.length >= obj.contents.length) continue;

        dict.set(PDFName.of("Filter"), PDFName.of("FlateDecode"));
        ctx.assign(ref, PDFRawStream.of(dict, new Uint8Array(compressed)));
        didCompress = true;
      } catch {
        continue;
      }
    }

    if (!didCompress) return inputBytes;
    return doc.save();
  } catch {
    return inputBytes;
  }
}

// ─── Types ──────────────────────────────────────────────

export interface PDFGeneratorOptions {
  orgName: string;
  orgSiret?: string;
  orgNda?: string;
  orgAdresse?: string;
  orgEmail?: string;
  orgTelephone?: string;
  orgLogo?: string; // URL or base64
}

export interface ConventionData {
  // Session
  sessionNom: string;
  sessionNumero: string;
  dateDebut: string;
  dateFin: string;
  dureeHeures: number;
  dureeJours: number;
  lieu: string;
  modalite: string; // Présentiel, Distanciel, Mixte
  // Entreprise commanditaire
  entrepriseNom: string;
  entrepriseSiret?: string;
  entrepriseAdresse?: string;
  entrepriseRepresentant?: string;
  // Formateur
  formateurNom?: string;
  // Apprenants
  apprenants: { prenom: string; nom: string }[];
  // Tarif
  prixHt: number;
  tva: number;
  prixTtc: number;
  // Objectifs
  objectifs?: string[];
  // Programme (modules)
  programme?: { titre: string; duree?: string }[];
}

export interface AttestationData {
  apprenantPrenom: string;
  apprenantNom: string;
  apprenantDateNaissance?: string;
  sessionNom: string;
  sessionNumero: string;
  dateDebut: string;
  dateFin: string;
  dureeHeures: number;
  lieu: string;
  objectifs?: string[];
  resultat?: string; // Acquis, En cours d'acquisition, Non acquis
  dateEmission: string;
}

export interface ConvocationData {
  apprenantPrenom: string;
  apprenantNom: string;
  sessionNom: string;
  sessionNumero: string;
  dateDebut: string;
  dateFin: string;
  lieu: string;
  horaireDebut?: string;
  horaireFin?: string;
  formateurNom?: string;
  dateEmission: string;
}

export interface DevisData {
  devisNumero: string;
  dateEmission: string;
  dateEcheance?: string;
  objet?: string;
  // Destinataire
  entrepriseNom?: string;
  entrepriseSiret?: string;
  entrepriseAdresse?: string;
  contactNom?: string;
  particulierNom?: string;
  particulierEmail?: string;
  particulierAdresse?: string;
  // Lignes
  lignes: {
    designation: string;
    description?: string;
    quantite: number;
    prixUnitaireHt: number;
    tauxTva: number;
    montantHt: number;
  }[];
  // Totaux
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  // Conditions
  conditions?: string;
  mentionsLegales?: string;
}

export interface ProgrammeFormationData {
  intitule: string;
  sousTitle?: string;
  description?: string;
  dureeHeures?: number;
  dureeJours?: number;
  modalite?: string;
  publicVise?: string[];
  prerequis?: string[];
  objectifs?: string[];
  competences?: string[];
  programme: { titre: string; contenu?: string; duree?: string }[];
  dateEmission: string;
}

export interface ContratSousTraitanceData {
  // Formateur
  formateurPrenom: string;
  formateurNom: string;
  formateurSiret?: string;
  formateurNda?: string;
  formateurAdresse?: string;
  // Session
  sessionNom: string;
  sessionNumero: string;
  dateDebut: string;
  dateFin: string;
  dureeHeures: number;
  dureeJours: number;
  lieu: string;
  modalite: string;
  // Financier
  tarifJournalier: number;
  tauxTva: number;
  nombreJours: number;
  montantHt: number;
  montantTva: number;
  montantTtc: number;
  // Contenu
  objectifs?: string[];
  dateEmission: string;
}

export interface EmargementData {
  sessionNom: string;
  sessionNumero: string;
  date: string;
  creneaux: { heureDebut: string; heureFin: string; formateur?: string }[];
  apprenants: { prenom: string; nom: string }[];
  formateurNom?: string;
}

// ─── Couleurs ───────────────────────────────────────────

const ORANGE = rgb(249 / 255, 115 / 255, 22 / 255); // #F97316
const DARK_BG = rgb(20 / 255, 20 / 255, 20 / 255);
const DARK_TEXT = rgb(30 / 255, 30 / 255, 30 / 255);
const GRAY_TEXT = rgb(100 / 255, 100 / 255, 100 / 255);
const LIGHT_GRAY = rgb(230 / 255, 230 / 255, 230 / 255);
const WHITE = rgb(1, 1, 1);

// ─── Helpers ────────────────────────────────────────────

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  opts: PDFGeneratorOptions,
  title: string,
) {
  const { width, height } = page.getSize();

  // Orange top bar
  page.drawRectangle({
    x: 0,
    y: height - 8,
    width,
    height: 8,
    color: ORANGE,
  });

  // Org name
  page.drawText(opts.orgName, {
    x: 50,
    y: height - 50,
    size: 16,
    font: fontBold,
    color: ORANGE,
  });

  // Org details (small)
  let detailY = height - 68;
  const details: string[] = [];
  if (opts.orgSiret) details.push(`SIRET : ${opts.orgSiret}`);
  if (opts.orgNda) details.push(`NDA : ${opts.orgNda}`);
  if (opts.orgAdresse) details.push(opts.orgAdresse);
  if (opts.orgEmail) details.push(opts.orgEmail);
  if (opts.orgTelephone) details.push(opts.orgTelephone);

  for (const d of details) {
    page.drawText(d, { x: 50, y: detailY, size: 8, font, color: GRAY_TEXT });
    detailY -= 12;
  }

  // Document title
  const titleY = detailY - 20;
  page.drawText(title, {
    x: 50,
    y: titleY,
    size: 18,
    font: fontBold,
    color: DARK_TEXT,
  });

  // Separator line
  page.drawLine({
    start: { x: 50, y: titleY - 10 },
    end: { x: width - 50, y: titleY - 10 },
    thickness: 1,
    color: LIGHT_GRAY,
  });

  return titleY - 30; // Return Y position for content start
}

function drawFooter(page: PDFPage, font: PDFFont, opts: PDFGeneratorOptions) {
  const { width } = page.getSize();

  page.drawLine({
    start: { x: 50, y: 50 },
    end: { x: width - 50, y: 50 },
    thickness: 0.5,
    color: LIGHT_GRAY,
  });

  const footerText = `${opts.orgName}${opts.orgNda ? ` — NDA : ${opts.orgNda}` : ""}${opts.orgSiret ? ` — SIRET : ${opts.orgSiret}` : ""}`;
  const footerWidth = font.widthOfTextAtSize(footerText, 7);
  page.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: 35,
    size: 7,
    font,
    color: GRAY_TEXT,
  });
}

function drawSection(
  page: PDFPage,
  fontBold: PDFFont,
  title: string,
  y: number,
): number {
  page.drawText(title, {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: ORANGE,
  });
  return y - 18;
}

function drawLabelValue(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  label: string,
  value: string,
  y: number,
  x: number = 50,
): number {
  page.drawText(`${label} :`, { x, y, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawText(value, {
    x: x + fontBold.widthOfTextAtSize(`${label} : `, 9),
    y,
    size: 9,
    font,
    color: DARK_TEXT,
  });
  return y - 15;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  // Split by newlines first, then wrap each paragraph by words
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  return lines;
}

// ─── Convention de formation ────────────────────────────

export async function generateConvention(
  opts: PDFGeneratorOptions,
  data: ConventionData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, "CONVENTION DE FORMATION PROFESSIONNELLE");

  // Article 1 — Objet
  y = drawSection(page, fontBold, "Article 1 — Objet", y);
  const objetLines = wrapText(
    `En exécution de la présente convention, l'organisme de formation s'engage à organiser l'action de formation intitulée « ${data.sessionNom} » (Réf. ${data.sessionNumero}).`,
    font,
    9,
    width - 100,
  );
  for (const line of objetLines) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 5;

  // Article 2 — Nature et caractéristiques
  y = drawSection(page, fontBold, "Article 2 — Nature et caractéristiques", y);
  y = drawLabelValue(page, font, fontBold, "Intitulé", data.sessionNom, y);
  y = drawLabelValue(page, font, fontBold, "Dates", `Du ${data.dateDebut} au ${data.dateFin}`, y);
  y = drawLabelValue(page, font, fontBold, "Durée", `${data.dureeHeures}h (${data.dureeJours} jour(s))`, y);
  y = drawLabelValue(page, font, fontBold, "Modalité", data.modalite, y);
  y = drawLabelValue(page, font, fontBold, "Lieu", data.lieu, y);
  if (data.formateurNom) {
    y = drawLabelValue(page, font, fontBold, "Formateur", data.formateurNom, y);
  }
  y -= 5;

  // Objectifs
  if (data.objectifs && data.objectifs.length > 0) {
    y = drawSection(page, fontBold, "Objectifs pédagogiques", y);
    for (const obj of data.objectifs) {
      page.drawText(`• ${obj}`, { x: 60, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 5;
  }

  // Programme
  if (data.programme && data.programme.length > 0) {
    y = drawSection(page, fontBold, "Programme", y);
    for (const mod of data.programme) {
      const label = mod.duree ? `${mod.titre} (${mod.duree})` : mod.titre;
      page.drawText(`• ${label}`, { x: 60, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 5;
  }

  // Check if we need a new page
  if (y < 250) {
    drawFooter(page, font, opts);
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  }

  // Article 3 — Entreprise
  y = drawSection(page, fontBold, "Article 3 — Entreprise commanditaire", y);
  y = drawLabelValue(page, font, fontBold, "Raison sociale", data.entrepriseNom, y);
  if (data.entrepriseSiret) y = drawLabelValue(page, font, fontBold, "SIRET", data.entrepriseSiret, y);
  if (data.entrepriseAdresse) y = drawLabelValue(page, font, fontBold, "Adresse", data.entrepriseAdresse, y);
  if (data.entrepriseRepresentant) y = drawLabelValue(page, font, fontBold, "Représentant", data.entrepriseRepresentant, y);
  y -= 5;

  // Article 4 — Stagiaires
  y = drawSection(page, fontBold, "Article 4 — Stagiaire(s)", y);
  for (const a of data.apprenants) {
    page.drawText(`• ${a.prenom} ${a.nom}`, { x: 60, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 5;

  // Article 5 — Dispositions financières
  y = drawSection(page, fontBold, "Article 5 — Dispositions financières", y);
  y = drawLabelValue(page, font, fontBold, "Montant HT", `${data.prixHt.toFixed(2)} €`, y);
  y = drawLabelValue(page, font, fontBold, "TVA", data.tva === 0 ? "Exonéré (art. 261-4-4°a du CGI)" : `${data.tva.toFixed(2)} €`, y);
  y = drawLabelValue(page, font, fontBold, "Montant TTC", `${data.prixTtc.toFixed(2)} €`, y);
  y -= 15;

  // Signatures
  y = drawSection(page, fontBold, "Signatures", y);
  y -= 5;

  // Two columns for signatures
  const colWidth = (width - 100) / 2;
  page.drawText("L'organisme de formation", { x: 50, y, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawText("L'entreprise", { x: 50 + colWidth + 20, y, size: 9, font: fontBold, color: DARK_TEXT });
  y -= 15;
  page.drawText(opts.orgName, { x: 50, y, size: 9, font, color: DARK_TEXT });
  page.drawText(data.entrepriseNom, { x: 50 + colWidth + 20, y, size: 9, font, color: DARK_TEXT });
  y -= 12;
  page.drawText("Date et signature :", { x: 50, y, size: 8, font, color: GRAY_TEXT });
  page.drawText("Date et signature :", { x: 50 + colWidth + 20, y, size: 8, font, color: GRAY_TEXT });

  // Signature boxes
  y -= 5;
  page.drawRectangle({ x: 50, y: y - 60, width: colWidth - 10, height: 60, borderColor: LIGHT_GRAY, borderWidth: 0.5 });
  page.drawRectangle({ x: 50 + colWidth + 20, y: y - 60, width: colWidth - 10, height: 60, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Attestation de fin de formation ────────────────────

export async function generateAttestation(
  opts: PDFGeneratorOptions,
  data: AttestationData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, "ATTESTATION DE FIN DE FORMATION");

  // Attestation body
  y -= 10;
  const intro = `Je soussigné(e), représentant(e) de ${opts.orgName}, organisme de formation${opts.orgNda ? ` déclaré sous le numéro ${opts.orgNda}` : ""}, atteste que :`;
  const introLines = wrapText(intro, font, 10, width - 100);
  for (const line of introLines) {
    page.drawText(line, { x: 50, y, size: 10, font, color: DARK_TEXT });
    y -= 15;
  }
  y -= 10;

  // Apprenant info box
  page.drawRectangle({
    x: 50,
    y: y - 70,
    width: width - 100,
    height: 70,
    color: rgb(248 / 255, 248 / 255, 248 / 255),
    borderColor: LIGHT_GRAY,
    borderWidth: 0.5,
  });

  y -= 18;
  page.drawText(`${data.apprenantPrenom} ${data.apprenantNom}`, {
    x: 65,
    y,
    size: 14,
    font: fontBold,
    color: DARK_TEXT,
  });
  y -= 18;
  if (data.apprenantDateNaissance) {
    page.drawText(`Né(e) le ${data.apprenantDateNaissance}`, { x: 65, y, size: 9, font, color: GRAY_TEXT });
    y -= 15;
  }

  y -= 30;
  const suivi = `a suivi la formation « ${data.sessionNom} » (Réf. ${data.sessionNumero})`;
  page.drawText(suivi, { x: 50, y, size: 10, font, color: DARK_TEXT });
  y -= 20;

  y = drawLabelValue(page, font, fontBold, "Du", `${data.dateDebut} au ${data.dateFin}`, y);
  y = drawLabelValue(page, font, fontBold, "Durée", `${data.dureeHeures} heures`, y);
  y = drawLabelValue(page, font, fontBold, "Lieu", data.lieu, y);
  y -= 10;

  // Objectifs
  if (data.objectifs && data.objectifs.length > 0) {
    y = drawSection(page, fontBold, "Objectifs de la formation", y);
    for (const obj of data.objectifs) {
      page.drawText(`• ${obj}`, { x: 60, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 10;
  }

  // Résultat
  if (data.resultat) {
    y = drawSection(page, fontBold, "Résultat de l'évaluation", y);
    page.drawText(data.resultat, { x: 50, y, size: 10, font: fontBold, color: DARK_TEXT });
    y -= 20;
  }

  // Date et signature
  y -= 20;
  page.drawText(`Fait à ${opts.orgAdresse?.split(",")[0]?.trim() || "___________"}, le ${data.dateEmission}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: DARK_TEXT,
  });
  y -= 25;
  page.drawText("Le responsable de l'organisme de formation", { x: 50, y, size: 9, font, color: GRAY_TEXT });
  y -= 5;
  page.drawRectangle({ x: 50, y: y - 60, width: 200, height: 60, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Convocation ────────────────────────────────────────

export async function generateConvocation(
  opts: PDFGeneratorOptions,
  data: ConvocationData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([595.28, 841.89]);
  let y = drawHeader(page, font, fontBold, opts, "CONVOCATION À LA FORMATION");

  y -= 10;
  page.drawText(`${data.apprenantPrenom} ${data.apprenantNom}`, {
    x: 50,
    y,
    size: 12,
    font: fontBold,
    color: DARK_TEXT,
  });
  y -= 25;

  page.drawText("Vous êtes convoqué(e) à la session de formation suivante :", {
    x: 50,
    y,
    size: 10,
    font,
    color: DARK_TEXT,
  });
  y -= 25;

  y = drawLabelValue(page, font, fontBold, "Formation", `${data.sessionNom} (${data.sessionNumero})`, y);
  y = drawLabelValue(page, font, fontBold, "Dates", `Du ${data.dateDebut} au ${data.dateFin}`, y);
  if (data.horaireDebut) {
    y = drawLabelValue(page, font, fontBold, "Horaires", `${data.horaireDebut} — ${data.horaireFin || ""}`, y);
  }
  y = drawLabelValue(page, font, fontBold, "Lieu", data.lieu, y);
  if (data.formateurNom) {
    y = drawLabelValue(page, font, fontBold, "Formateur", data.formateurNom, y);
  }
  y -= 20;

  page.drawText("Merci de vous présenter 10 minutes avant le début de la formation.", {
    x: 50,
    y,
    size: 9,
    font,
    color: GRAY_TEXT,
  });
  y -= 30;

  page.drawText(`Fait le ${data.dateEmission}`, { x: 50, y, size: 10, font, color: DARK_TEXT });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Feuille d'émargement ───────────────────────────────

export async function generateEmargement(
  opts: PDFGeneratorOptions,
  data: EmargementData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([841.89, 595.28]); // A4 paysage
  const { width, height } = page.getSize();

  // Header
  page.drawRectangle({ x: 0, y: height - 6, width, height: 6, color: ORANGE });
  page.drawText(opts.orgName, { x: 30, y: height - 30, size: 12, font: fontBold, color: ORANGE });
  page.drawText("FEUILLE D'ÉMARGEMENT", { x: 30, y: height - 50, size: 14, font: fontBold, color: DARK_TEXT });

  let y = height - 70;
  page.drawText(`Formation : ${data.sessionNom} (${data.sessionNumero})`, { x: 30, y, size: 9, font: fontBold, color: DARK_TEXT });
  y -= 14;
  page.drawText(`Date : ${data.date}`, { x: 30, y, size: 9, font, color: DARK_TEXT });
  if (data.formateurNom) {
    page.drawText(`Formateur : ${data.formateurNom}`, { x: 300, y, size: 9, font, color: DARK_TEXT });
  }
  y -= 20;

  // Table
  const tableX = 30;
  const nameColW = 180;
  const creneauColW = data.creneaux.length > 0 ? Math.min(120, (width - 80 - nameColW) / data.creneaux.length) : 120;
  const rowH = 28;

  // Header row
  page.drawRectangle({
    x: tableX,
    y: y - rowH,
    width: nameColW + creneauColW * Math.max(data.creneaux.length, 2),
    height: rowH,
    color: rgb(240 / 255, 240 / 255, 240 / 255),
  });

  page.drawText("Nom / Prénom", { x: tableX + 5, y: y - 18, size: 8, font: fontBold, color: DARK_TEXT });

  // Créneau headers
  for (let i = 0; i < data.creneaux.length; i++) {
    const cx = tableX + nameColW + i * creneauColW;
    page.drawText(`${data.creneaux[i].heureDebut}`, { x: cx + 5, y: y - 12, size: 7, font: fontBold, color: DARK_TEXT });
    page.drawText(`${data.creneaux[i].heureFin}`, { x: cx + 5, y: y - 22, size: 7, font, color: GRAY_TEXT });
  }

  y -= rowH;

  // Rows for each apprenant
  for (let j = 0; j < data.apprenants.length; j++) {
    const rowY = y - (j + 1) * rowH;

    // Alternating bg
    if (j % 2 === 0) {
      page.drawRectangle({
        x: tableX,
        y: rowY,
        width: nameColW + creneauColW * Math.max(data.creneaux.length, 2),
        height: rowH,
        color: rgb(252 / 255, 252 / 255, 252 / 255),
      });
    }

    // Name
    page.drawText(`${data.apprenants[j].nom} ${data.apprenants[j].prenom}`, {
      x: tableX + 5,
      y: rowY + 10,
      size: 8,
      font,
      color: DARK_TEXT,
    });

    // Signature cells
    for (let i = 0; i < data.creneaux.length; i++) {
      const cx = tableX + nameColW + i * creneauColW;
      page.drawRectangle({
        x: cx,
        y: rowY,
        width: creneauColW,
        height: rowH,
        borderColor: LIGHT_GRAY,
        borderWidth: 0.5,
      });
    }

    // Name cell border
    page.drawRectangle({
      x: tableX,
      y: rowY,
      width: nameColW,
      height: rowH,
      borderColor: LIGHT_GRAY,
      borderWidth: 0.5,
    });
  }

  // Formateur signature at bottom
  const bottomY = y - (data.apprenants.length + 1) * rowH - 20;
  page.drawText("Signature du formateur :", { x: 30, y: bottomY, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawRectangle({ x: 30, y: bottomY - 50, width: 200, height: 45, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  // Footer
  const footerText = `${opts.orgName}${opts.orgNda ? ` — NDA : ${opts.orgNda}` : ""}`;
  page.drawText(footerText, { x: 30, y: 20, size: 7, font, color: GRAY_TEXT });

  return doc.save();
}

// ─── Devis PDF ─────────────────────────────────────────

export async function generateDevisPdf(
  opts: PDFGeneratorOptions,
  data: DevisData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, `DEVIS ${data.devisNumero}`);

  // Dates
  y = drawLabelValue(page, font, fontBold, "Date d'émission", data.dateEmission, y);
  if (data.dateEcheance) {
    y = drawLabelValue(page, font, fontBold, "Échéance", data.dateEcheance, y);
  }
  y -= 10;

  // Destinataire
  y = drawSection(page, fontBold, "Destinataire", y);
  if (data.entrepriseNom) {
    y = drawLabelValue(page, font, fontBold, "Entreprise", data.entrepriseNom, y);
    if (data.entrepriseSiret) y = drawLabelValue(page, font, fontBold, "SIRET", data.entrepriseSiret, y);
    if (data.entrepriseAdresse) y = drawLabelValue(page, font, fontBold, "Adresse", data.entrepriseAdresse, y);
    if (data.contactNom) y = drawLabelValue(page, font, fontBold, "Contact", data.contactNom, y);
  } else if (data.particulierNom) {
    y = drawLabelValue(page, font, fontBold, "Nom", data.particulierNom, y);
    if (data.particulierEmail) y = drawLabelValue(page, font, fontBold, "Email", data.particulierEmail, y);
    if (data.particulierAdresse) y = drawLabelValue(page, font, fontBold, "Adresse", data.particulierAdresse, y);
  }
  y -= 10;

  // Objet
  if (data.objet) {
    y = drawSection(page, fontBold, "Objet", y);
    const objetLines = wrapText(data.objet, font, 9, width - 100);
    for (const line of objetLines) {
      page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 10;
  }

  // Lignes — Table header
  y = drawSection(page, fontBold, "Détail", y);
  const colX = { designation: 50, qte: 320, pu: 370, tva: 430, ht: 490 };
  const colHeaders = [
    { label: "Désignation", x: colX.designation },
    { label: "Qté", x: colX.qte },
    { label: "P.U. HT", x: colX.pu },
    { label: "TVA", x: colX.tva },
    { label: "Montant HT", x: colX.ht },
  ];

  // Table header bg
  page.drawRectangle({
    x: 50, y: y - 15, width: width - 100, height: 18,
    color: rgb(240 / 255, 240 / 255, 240 / 255),
  });
  for (const col of colHeaders) {
    page.drawText(col.label, { x: col.x, y: y - 11, size: 7, font: fontBold, color: DARK_TEXT });
  }
  y -= 22;

  // Table rows
  for (const ligne of data.lignes) {
    if (y < 120) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }

    // Designation (may wrap)
    const desigLines = wrapText(ligne.designation, font, 8, 260);
    for (let i = 0; i < desigLines.length; i++) {
      page.drawText(desigLines[i], { x: colX.designation, y: y - i * 11, size: 8, font, color: DARK_TEXT });
    }
    page.drawText(String(ligne.quantite), { x: colX.qte, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.prixUnitaireHt.toFixed(2)} €`, { x: colX.pu, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.tauxTva}%`, { x: colX.tva, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.montantHt.toFixed(2)} €`, { x: colX.ht, y, size: 8, font, color: DARK_TEXT });

    // Description (smaller, gray)
    if (ligne.description) {
      const descLines = wrapText(ligne.description, font, 7, 260);
      const descStartY = y - Math.max(desigLines.length, 1) * 11;
      for (let i = 0; i < Math.min(descLines.length, 2); i++) {
        page.drawText(descLines[i], { x: colX.designation, y: descStartY - i * 10, size: 7, font, color: GRAY_TEXT });
      }
      y = descStartY - Math.min(descLines.length, 2) * 10 - 6;
    } else {
      y -= Math.max(desigLines.length, 1) * 11 + 6;
    }

    // Separator line
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.3,
      color: LIGHT_GRAY,
    });
    y -= 6;
  }

  // Totaux
  y -= 10;
  const totalsX = 400;
  page.drawText("Total HT :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawText(`${data.totalHt.toFixed(2)} €`, { x: totalsX + 80, y, size: 9, font, color: DARK_TEXT });
  y -= 15;
  if (data.totalTva === 0) {
    page.drawText("TVA :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
    page.drawText("Exonéré (art. 261-4-4°a CGI)", { x: totalsX + 80, y, size: 8, font, color: GRAY_TEXT });
  } else {
    page.drawText("TVA :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
    page.drawText(`${data.totalTva.toFixed(2)} €`, { x: totalsX + 80, y, size: 9, font, color: DARK_TEXT });
  }
  y -= 18;
  // TTC box
  page.drawRectangle({
    x: totalsX - 5, y: y - 5, width: 155, height: 22,
    color: rgb(252 / 255, 237 / 255, 220 / 255),
    borderColor: ORANGE,
    borderWidth: 0.5,
  });
  page.drawText("Total TTC :", { x: totalsX, y, size: 10, font: fontBold, color: ORANGE });
  page.drawText(`${data.totalTtc.toFixed(2)} €`, { x: totalsX + 80, y, size: 10, font: fontBold, color: ORANGE });
  y -= 30;

  // Conditions
  if (data.conditions) {
    if (y < 150) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
    y = drawSection(page, fontBold, "Conditions", y);
    const condLines = wrapText(data.conditions, font, 8, width - 100);
    for (const line of condLines) {
      page.drawText(line, { x: 50, y, size: 8, font, color: DARK_TEXT });
      y -= 12;
    }
    y -= 10;
  }

  // Mentions légales
  if (data.mentionsLegales) {
    if (y < 120) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
    const mentionsLines = wrapText(data.mentionsLegales, font, 7, width - 100);
    for (const line of mentionsLines) {
      page.drawText(line, { x: 50, y, size: 7, font, color: GRAY_TEXT });
      y -= 10;
    }
    y -= 10;
  }

  // Signature area
  if (y < 130) {
    drawFooter(page, font, opts);
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  }
  y -= 10;
  page.drawText("Bon pour accord — Date et signature du client :", {
    x: 50, y, size: 9, font: fontBold, color: DARK_TEXT,
  });
  y -= 5;
  page.drawRectangle({
    x: 50, y: y - 60, width: 250, height: 60,
    borderColor: LIGHT_GRAY, borderWidth: 0.5,
  });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Contrat de sous-traitance ──────────────────────────

export async function generateContratSousTraitance(
  opts: PDFGeneratorOptions,
  data: ContratSousTraitanceData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, "CONTRAT DE SOUS-TRAITANCE");

  // Article 1 — Parties
  y = drawSection(page, fontBold, "Article 1 — Parties", y);
  const partiesIntro = wrapText(
    `Entre ${opts.orgName}${opts.orgSiret ? `, SIRET ${opts.orgSiret}` : ""}${opts.orgNda ? `, NDA ${opts.orgNda}` : ""}, ci-apres « l'Organisme de Formation »,`,
    font, 9, width - 100,
  );
  for (const line of partiesIntro) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 3;
  const partiesST = wrapText(
    `Et ${data.formateurPrenom} ${data.formateurNom}${data.formateurSiret ? `, SIRET ${data.formateurSiret}` : ""}${data.formateurNda ? `, NDA ${data.formateurNda}` : ""}${data.formateurAdresse ? `, ${data.formateurAdresse}` : ""}, ci-apres « le Sous-traitant »,`,
    font, 9, width - 100,
  );
  for (const line of partiesST) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 10;

  // Article 2 — Objet
  y = drawSection(page, fontBold, "Article 2 — Objet de la prestation", y);
  const objetLines = wrapText(
    `Le Sous-traitant s'engage a realiser, pour le compte de l'Organisme de Formation, la prestation de formation suivante :`,
    font, 9, width - 100,
  );
  for (const line of objetLines) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 5;
  y = drawLabelValue(page, font, fontBold, "Intitule", `${data.sessionNom} (${data.sessionNumero})`, y);
  y = drawLabelValue(page, font, fontBold, "Dates", `Du ${data.dateDebut} au ${data.dateFin}`, y);
  y = drawLabelValue(page, font, fontBold, "Duree", `${data.dureeHeures}h (${data.dureeJours} jour(s))`, y);
  y = drawLabelValue(page, font, fontBold, "Modalite", data.modalite, y);
  y = drawLabelValue(page, font, fontBold, "Lieu", data.lieu, y);
  y -= 5;

  // Objectifs
  if (data.objectifs && data.objectifs.length > 0) {
    y = drawSection(page, fontBold, "Objectifs pedagogiques", y);
    for (const obj of data.objectifs) {
      const objLines = wrapText(`- ${obj}`, font, 9, width - 110);
      for (const line of objLines) {
        page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
    }
    y -= 5;
  }

  // Check page space
  if (y < 300) {
    drawFooter(page, font, opts);
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  }

  // Article 3 — Obligations
  y = drawSection(page, fontBold, "Article 3 — Obligations du Sous-traitant", y);
  const obligations = [
    "Dispenser la formation conformement au programme convenu.",
    "Respecter le reglement interieur de l'organisme de formation.",
    "Assurer le suivi pedagogique des stagiaires (emargement, evaluations).",
    "Remettre les documents pedagogiques necessaires.",
    data.formateurNda
      ? `Justifier d'une declaration d'activite en cours de validite (NDA : ${data.formateurNda}).`
      : "Justifier d'une declaration d'activite en cours de validite.",
  ];
  for (const ob of obligations) {
    const obLines = wrapText(`- ${ob}`, font, 9, width - 110);
    for (const line of obLines) {
      page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
  }
  y -= 10;

  // Article 4 — Dispositions financieres
  y = drawSection(page, fontBold, "Article 4 — Dispositions financieres", y);
  y = drawLabelValue(page, font, fontBold, "Tarif journalier HT", `${data.tarifJournalier.toFixed(2)} EUR`, y);
  y = drawLabelValue(page, font, fontBold, "Nombre de jours", `${data.nombreJours}`, y);
  y = drawLabelValue(page, font, fontBold, "Montant total HT", `${data.montantHt.toFixed(2)} EUR`, y);
  y = drawLabelValue(
    page, font, fontBold, "TVA",
    data.tauxTva === 0 ? "Exonere (art. 261-4-4a du CGI)" : `${data.montantTva.toFixed(2)} EUR (${data.tauxTva}%)`,
    y,
  );
  y = drawLabelValue(page, font, fontBold, "Montant total TTC", `${data.montantTtc.toFixed(2)} EUR`, y);
  y -= 5;
  const paiementLines = wrapText(
    "Le reglement sera effectue par virement bancaire dans un delai de 30 jours apres reception de la facture du Sous-traitant.",
    font, 9, width - 100,
  );
  for (const line of paiementLines) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 10;

  // Check page space for signatures
  if (y < 180) {
    drawFooter(page, font, opts);
    page = doc.addPage([595.28, 841.89]);
    y = 780;
  }

  // Article 5 — Dispositions generales
  y = drawSection(page, fontBold, "Article 5 — Dispositions generales", y);
  const dispositions = wrapText(
    "Le present contrat est regi par le droit francais. En cas de litige, les parties s'engagent a rechercher une solution amiable avant toute action judiciaire.",
    font, 9, width - 100,
  );
  for (const line of dispositions) {
    page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
    y -= 13;
  }
  y -= 15;

  // Date
  page.drawText(`Fait le ${data.dateEmission}`, { x: 50, y, size: 10, font, color: DARK_TEXT });
  y -= 25;

  // Signatures — two columns
  const colWidth = (width - 100) / 2;
  y = drawSection(page, fontBold, "Signatures", y);
  y -= 5;
  page.drawText("L'Organisme de Formation", { x: 50, y, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawText("Le Sous-traitant", { x: 50 + colWidth + 20, y, size: 9, font: fontBold, color: DARK_TEXT });
  y -= 15;
  page.drawText(opts.orgName, { x: 50, y, size: 9, font, color: DARK_TEXT });
  page.drawText(`${data.formateurPrenom} ${data.formateurNom}`, { x: 50 + colWidth + 20, y, size: 9, font, color: DARK_TEXT });
  y -= 12;
  page.drawText("Date et signature :", { x: 50, y, size: 8, font, color: GRAY_TEXT });
  page.drawText("Date et signature :", { x: 50 + colWidth + 20, y, size: 8, font, color: GRAY_TEXT });
  y -= 5;
  page.drawRectangle({ x: 50, y: y - 60, width: colWidth - 10, height: 60, borderColor: LIGHT_GRAY, borderWidth: 0.5 });
  page.drawRectangle({ x: 50 + colWidth + 20, y: y - 60, width: colWidth - 10, height: 60, borderColor: LIGHT_GRAY, borderWidth: 0.5 });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Programme de formation PDF ─────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function generateProgrammePdf(
  opts: PDFGeneratorOptions,
  data: ProgrammeFormationData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, "PROGRAMME DE FORMATION");

  const maxW = width - 100;

  const ensurePage = (needed: number) => {
    if (y < needed) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
  };

  // ── Intitulé ──
  const intituleLines = wrapText(data.intitule, fontBold, 13, maxW);
  for (const line of intituleLines) {
    page.drawText(line, { x: 50, y, size: 13, font: fontBold, color: DARK_TEXT });
    y -= 18;
  }
  if (data.sousTitle) {
    const subLines = wrapText(data.sousTitle, font, 10, maxW);
    for (const line of subLines) {
      page.drawText(line, { x: 50, y, size: 10, font, color: GRAY_TEXT });
      y -= 14;
    }
  }
  y -= 10;

  // ── Informations générales ──
  y = drawSection(page, fontBold, "Informations générales", y);
  if (data.dureeHeures || data.dureeJours) {
    const dureeStr = [
      data.dureeHeures ? `${data.dureeHeures}h` : null,
      data.dureeJours ? `${data.dureeJours} jour(s)` : null,
    ].filter(Boolean).join(" — ");
    y = drawLabelValue(page, font, fontBold, "Durée", dureeStr, y);
  }
  if (data.modalite) {
    y = drawLabelValue(page, font, fontBold, "Modalité", data.modalite, y);
  }
  y -= 8;

  // ── Public visé ──
  if (data.publicVise && data.publicVise.length > 0) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Public visé", y);
    for (const p of data.publicVise) {
      const pLines = wrapText(`• ${p}`, font, 9, maxW - 10);
      for (const line of pLines) {
        ensurePage(80);
        page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
    }
    y -= 8;
  }

  // ── Prérequis ──
  if (data.prerequis && data.prerequis.length > 0) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Prérequis", y);
    for (const p of data.prerequis) {
      const pLines = wrapText(`• ${p}`, font, 9, maxW - 10);
      for (const line of pLines) {
        ensurePage(80);
        page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
    }
    y -= 8;
  }

  // ── Objectifs pédagogiques ──
  if (data.objectifs && data.objectifs.length > 0) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Objectifs pédagogiques", y);
    for (const obj of data.objectifs) {
      const objLines = wrapText(`• ${obj}`, font, 9, maxW - 10);
      for (const line of objLines) {
        ensurePage(80);
        page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
    }
    y -= 8;
  }

  // ── Compétences visées ──
  if (data.competences && data.competences.length > 0) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Compétences visées", y);
    for (const c of data.competences) {
      const cLines = wrapText(`• ${c}`, font, 9, maxW - 10);
      for (const line of cLines) {
        ensurePage(80);
        page.drawText(line, { x: 60, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
    }
    y -= 8;
  }

  // ── Programme détaillé ──
  if (data.programme.length > 0) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Programme détaillé", y);
    for (let i = 0; i < data.programme.length; i++) {
      const mod = data.programme[i];
      ensurePage(100);

      // Module title with optional duration
      const modTitle = mod.duree
        ? `${i + 1}. ${mod.titre} (${mod.duree})`
        : `${i + 1}. ${mod.titre}`;
      const modTitleLines = wrapText(modTitle, fontBold, 10, maxW - 10);
      for (const line of modTitleLines) {
        page.drawText(line, { x: 55, y, size: 10, font: fontBold, color: DARK_TEXT });
        y -= 14;
      }

      // Module content (HTML stripped)
      if (mod.contenu) {
        const plainContent = stripHtml(mod.contenu);
        const contentParagraphs = plainContent.split("\n").filter(l => l.trim());
        for (const para of contentParagraphs) {
          const paraLines = wrapText(para, font, 8, maxW - 20);
          for (const line of paraLines) {
            ensurePage(80);
            page.drawText(line, { x: 65, y, size: 8, font, color: DARK_TEXT });
            y -= 11;
          }
        }
      }
      y -= 6;
    }
    y -= 5;
  }

  // ── Description (si présente) ──
  if (data.description) {
    ensurePage(100);
    y = drawSection(page, fontBold, "Description", y);
    const descPlain = stripHtml(data.description);
    const descParagraphs = descPlain.split("\n").filter(l => l.trim());
    for (const para of descParagraphs) {
      const paraLines = wrapText(para, font, 9, maxW);
      for (const line of paraLines) {
        ensurePage(80);
        page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
        y -= 13;
      }
      y -= 4;
    }
    y -= 5;
  }

  // ── Date d'émission ──
  ensurePage(100);
  y -= 15;
  page.drawText(`Document généré le ${data.dateEmission}`, {
    x: 50, y, size: 8, font, color: GRAY_TEXT,
  });

  drawFooter(page, font, opts);

  return doc.save();
}

// ─── Facture PDF ────────────────────────────────────────

export interface FactureData {
  factureNumero: string;
  dateEmission: string;
  dateEcheance?: string;
  objet?: string;
  // Destinataire
  entrepriseNom?: string;
  entrepriseSiret?: string;
  entrepriseAdresse?: string;
  contactNom?: string;
  // Formation metadata
  formationNom?: string;
  lieuFormation?: string;
  datesFormation?: string;
  modalitePedagogique?: string;
  dureeFormation?: string;
  nombreParticipantsPrevus?: number;
  // Participants presents
  participantsPresents?: Array<{
    prenom: string;
    nom: string;
    dates_presence: string[];
  }>;
  // Lignes
  lignes: {
    designation: string;
    description?: string;
    quantite: number;
    prixUnitaireHt: number;
    tauxTva: number;
    montantHt: number;
  }[];
  // Totaux
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  // Conditions
  conditions?: string;
  mentionsLegales?: string;
  coordonneesBancaires?: string;
  exonerationTva?: boolean;
}

export async function generateFacturePdf(
  opts: PDFGeneratorOptions,
  data: FactureData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([595.28, 841.89]); // A4
  const { width } = page.getSize();
  let y = drawHeader(page, font, fontBold, opts, `FACTURE ${data.factureNumero}`);

  // Helper: ensure enough space, add new page if needed
  function ensurePageFact(minSpace: number) {
    if (y < minSpace) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
  }

  // Dates
  y = drawLabelValue(page, font, fontBold, "Date d'émission", data.dateEmission, y);
  if (data.dateEcheance) {
    y = drawLabelValue(page, font, fontBold, "Échéance", data.dateEcheance, y);
  }
  y -= 10;

  // Destinataire
  y = drawSection(page, fontBold, "Destinataire", y);
  if (data.entrepriseNom) {
    y = drawLabelValue(page, font, fontBold, "Entreprise", data.entrepriseNom, y);
    if (data.entrepriseSiret) y = drawLabelValue(page, font, fontBold, "SIRET", data.entrepriseSiret, y);
    if (data.entrepriseAdresse) y = drawLabelValue(page, font, fontBold, "Adresse", data.entrepriseAdresse, y);
    if (data.contactNom) y = drawLabelValue(page, font, fontBold, "Contact", data.contactNom, y);
  }
  y -= 10;

  // Objet
  if (data.objet) {
    y = drawSection(page, fontBold, "Objet", y);
    const objetLines = wrapText(data.objet, font, 9, width - 100);
    for (const line of objetLines) {
      page.drawText(line, { x: 50, y, size: 9, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 10;
  }

  // Formation info section
  if (data.datesFormation || data.lieuFormation || data.modalitePedagogique || data.dureeFormation) {
    ensurePageFact(150);
    y = drawSection(page, fontBold, "Formation", y);
    if (data.datesFormation) {
      y = drawLabelValue(page, font, fontBold, "Dates", data.datesFormation, y);
    }
    if (data.lieuFormation) {
      y = drawLabelValue(page, font, fontBold, "Lieu", data.lieuFormation, y);
    }
    if (data.modalitePedagogique) {
      y = drawLabelValue(page, font, fontBold, "Modalité", data.modalitePedagogique, y);
    }
    if (data.dureeFormation) {
      y = drawLabelValue(page, font, fontBold, "Durée", data.dureeFormation, y);
    }
    if (data.nombreParticipantsPrevus != null) {
      y = drawLabelValue(page, font, fontBold, "Participants prévus", String(data.nombreParticipantsPrevus), y);
    }
    y -= 10;
  }

  // Participants presents section
  if (data.participantsPresents && data.participantsPresents.length > 0) {
    ensurePageFact(80 + data.participantsPresents.length * 13);
    y = drawSection(page, fontBold, `Participants présents (${data.participantsPresents.length})`, y);

    for (const p of data.participantsPresents) {
      ensurePageFact(80);
      const presenceDates = p.dates_presence.map((d) => {
        const parts = d.split("-");
        return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
      }).join(", ");
      const line = `${p.nom.toUpperCase()} ${p.prenom}${presenceDates ? ` — ${presenceDates}` : ""}`;
      page.drawText(`• ${line}`, { x: 60, y, size: 8, font, color: DARK_TEXT });
      y -= 13;
    }
    y -= 10;
  }

  // Lignes — Table header
  ensurePageFact(120);
  y = drawSection(page, fontBold, "Détail", y);
  const colX = { designation: 50, qte: 320, pu: 370, tva: 430, ht: 490 };
  const colHeaders = [
    { label: "Désignation", x: colX.designation },
    { label: "Qté", x: colX.qte },
    { label: "P.U. HT", x: colX.pu },
    { label: "TVA", x: colX.tva },
    { label: "Montant HT", x: colX.ht },
  ];

  // Table header bg
  page.drawRectangle({
    x: 50, y: y - 15, width: width - 100, height: 18,
    color: rgb(240 / 255, 240 / 255, 240 / 255),
  });
  for (const col of colHeaders) {
    page.drawText(col.label, { x: col.x, y: y - 11, size: 7, font: fontBold, color: DARK_TEXT });
  }
  y -= 22;

  // Table rows
  for (const ligne of data.lignes) {
    if (y < 120) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }

    const desigLines = wrapText(ligne.designation, font, 8, 260);
    for (let i = 0; i < desigLines.length; i++) {
      page.drawText(desigLines[i], { x: colX.designation, y: y - i * 11, size: 8, font, color: DARK_TEXT });
    }
    page.drawText(String(ligne.quantite), { x: colX.qte, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.prixUnitaireHt.toFixed(2)} €`, { x: colX.pu, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.tauxTva}%`, { x: colX.tva, y, size: 8, font, color: DARK_TEXT });
    page.drawText(`${ligne.montantHt.toFixed(2)} €`, { x: colX.ht, y, size: 8, font, color: DARK_TEXT });

    if (ligne.description) {
      const descLines = wrapText(ligne.description, font, 7, 260);
      const descStartY = y - Math.max(desigLines.length, 1) * 11;
      for (let i = 0; i < Math.min(descLines.length, 2); i++) {
        page.drawText(descLines[i], { x: colX.designation, y: descStartY - i * 10, size: 7, font, color: GRAY_TEXT });
      }
      y = descStartY - Math.min(descLines.length, 2) * 10 - 6;
    } else {
      y -= Math.max(desigLines.length, 1) * 11 + 6;
    }

    // Separator line
    page.drawLine({
      start: { x: 50, y },
      end: { x: width - 50, y },
      thickness: 0.3,
      color: LIGHT_GRAY,
    });
    y -= 6;
  }

  // Totaux
  y -= 10;
  const totalsX = 400;
  page.drawText("Total HT :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
  page.drawText(`${data.totalHt.toFixed(2)} €`, { x: totalsX + 80, y, size: 9, font, color: DARK_TEXT });
  y -= 15;
  if (data.exonerationTva || data.totalTva === 0) {
    page.drawText("TVA :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
    page.drawText("Exonéré (art. 261-4-4°a CGI)", { x: totalsX + 80, y, size: 8, font, color: GRAY_TEXT });
  } else {
    page.drawText("TVA :", { x: totalsX, y, size: 9, font: fontBold, color: DARK_TEXT });
    page.drawText(`${data.totalTva.toFixed(2)} €`, { x: totalsX + 80, y, size: 9, font, color: DARK_TEXT });
  }
  y -= 18;
  // TTC box
  page.drawRectangle({
    x: totalsX - 5, y: y - 5, width: 155, height: 22,
    color: rgb(252 / 255, 237 / 255, 220 / 255),
    borderColor: ORANGE,
    borderWidth: 0.5,
  });
  page.drawText("Total TTC :", { x: totalsX, y, size: 10, font: fontBold, color: ORANGE });
  page.drawText(`${data.totalTtc.toFixed(2)} €`, { x: totalsX + 80, y, size: 10, font: fontBold, color: ORANGE });
  y -= 30;

  // Conditions
  if (data.conditions) {
    if (y < 150) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
    y = drawSection(page, fontBold, "Conditions de paiement", y);
    const condLines = wrapText(data.conditions, font, 8, width - 100);
    for (const line of condLines) {
      page.drawText(line, { x: 50, y, size: 8, font, color: DARK_TEXT });
      y -= 12;
    }
    y -= 10;
  }

  // Coordonnées bancaires
  if (data.coordonneesBancaires) {
    ensurePageFact(120);
    y = drawSection(page, fontBold, "Coordonnées bancaires", y);
    const bankLines = wrapText(data.coordonneesBancaires, font, 8, width - 100);
    for (const line of bankLines) {
      page.drawText(line, { x: 50, y, size: 8, font, color: DARK_TEXT });
      y -= 12;
    }
    y -= 10;
  }

  // Mentions légales
  if (data.mentionsLegales) {
    if (y < 120) {
      drawFooter(page, font, opts);
      page = doc.addPage([595.28, 841.89]);
      y = 780;
    }
    const mentionsLines = wrapText(data.mentionsLegales, font, 7, width - 100);
    for (const line of mentionsLines) {
      page.drawText(line, { x: 50, y, size: 7, font, color: GRAY_TEXT });
      y -= 10;
    }
  }

  drawFooter(page, font, opts);

  return doc.save();
}
