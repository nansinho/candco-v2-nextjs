// ═══════════════════════════════════════════════════════════════
// Utilitaire de formatage APA 7e édition
// Module TypeScript pur — utilisable côté client et serveur
// ═══════════════════════════════════════════════════════════════

export type ReferenceType =
  | "livre"
  | "article_revue"
  | "chapitre_livre"
  | "rapport"
  | "site_web"
  | "these"
  | "conference";

export interface ReferenceBiblio {
  id: string;
  type_reference: ReferenceType;
  auteurs: string | null;
  auteur_institutionnel: boolean;
  annee: string | null;
  titre: string;
  titre_ouvrage_parent: string | null;
  editeurs: string | null;
  titre_revue: string | null;
  editeur: string | null;
  volume: string | null;
  numero: string | null;
  pages: string | null;
  edition: string | null;
  doi: string | null;
  url: string | null;
  date_consultation: string | null;
  ordre: number;
  notes: string | null;
}

export const REFERENCE_TYPE_LABELS: Record<ReferenceType, string> = {
  livre: "Livre",
  article_revue: "Article de revue",
  chapitre_livre: "Chapitre de livre",
  rapport: "Rapport",
  site_web: "Site web",
  these: "Thèse",
  conference: "Conférence",
};

// ─── Helpers internes ─────────────────────────────────────

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function formatYear(annee: string | null): string {
  if (!annee || annee.trim() === "") return "(s.d.)";
  const trimmed = annee.trim();
  if (trimmed.toLowerCase() === "s.d." || trimmed.toLowerCase() === "s. d.") return "(s.d.)";
  if (trimmed.toLowerCase() === "sous presse") return "(sous presse)";
  return `(${trimmed})`;
}

function formatDOI(doi: string | null, asHtml: boolean): string {
  if (!doi || doi.trim() === "") return "";
  const cleaned = doi.trim();
  const fullUrl = cleaned.startsWith("http") ? cleaned : `https://doi.org/${cleaned}`;
  if (asHtml) {
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer">${fullUrl}</a>`;
  }
  return fullUrl;
}

function formatURL(
  url: string | null,
  dateConsultation: string | null,
  asHtml: boolean,
): string {
  if (!url || url.trim() === "") return "";
  const trimmedUrl = url.trim();
  const link = asHtml
    ? `<a href="${trimmedUrl}" target="_blank" rel="noopener noreferrer">${trimmedUrl}</a>`
    : trimmedUrl;

  if (dateConsultation) {
    const d = new Date(dateConsultation);
    if (!isNaN(d.getTime())) {
      const jour = d.getDate();
      const mois = MOIS_FR[d.getMonth()];
      const an = d.getFullYear();
      return `Consulté le ${jour} ${mois} ${an}, à l'adresse ${link}`;
    }
  }
  return link;
}

/** Construit le suffixe source (DOI prioritaire, sinon URL) */
function formatSource(
  ref: ReferenceBiblio,
  asHtml: boolean,
): string {
  const doi = formatDOI(ref.doi, asHtml);
  if (doi) return doi;
  return formatURL(ref.url, ref.date_consultation, asHtml);
}

/** Entoure le texte d'italiques */
function italic(text: string, asHtml: boolean): string {
  if (asHtml) return `<em>${text}</em>`;
  return text;
}

/** Joint les segments non-vides avec un espace */
function joinParts(parts: string[]): string {
  return parts.filter((p) => p.length > 0).join(" ");
}

/** S'assure qu'une chaîne se termine par un point */
function ensurePeriod(s: string): string {
  const trimmed = s.trim();
  if (trimmed === "") return "";
  if (trimmed.endsWith(".") || trimmed.endsWith("</a>")) return trimmed;
  return `${trimmed}.`;
}

// ─── Formateurs par type ──────────────────────────────────

function formatLivre(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);

  // Titre (italique) + édition
  let titreStr = italic(ref.titre, asHtml);
  if (ref.edition?.trim()) {
    titreStr += ` (${ref.edition.trim()})`;
  }

  const editeurStr = ref.editeur?.trim() || "";
  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(ensurePeriod(titreStr));
  if (editeurStr) parts.push(ensurePeriod(editeurStr));
  if (source) parts.push(source);

  return joinParts(parts);
}

function formatArticleRevue(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);

  // Titre article (pas d'italique)
  const titreArticle = ref.titre.trim();

  // Revue, Volume(Numéro), Pages (italique pour revue + volume)
  let revuePart = "";
  const revue = ref.titre_revue?.trim() || "";
  const vol = ref.volume?.trim() || "";
  const num = ref.numero?.trim() || "";
  const pages = ref.pages?.trim() || "";

  if (revue) {
    let revueVolStr = revue;
    if (vol) {
      revueVolStr += `, ${vol}`;
    }
    revuePart = italic(revueVolStr, asHtml);
    if (num) {
      revuePart += `(${num})`;
    }
    if (pages) {
      revuePart += `, ${pages}`;
    }
  }

  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(ensurePeriod(titreArticle));
  if (revuePart) parts.push(ensurePeriod(revuePart));
  if (source) parts.push(source);

  return joinParts(parts);
}

function formatChapitreLivre(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);

  // Titre du chapitre (pas d'italique)
  const titreChapitre = ref.titre.trim();

  // In Éditeurs (Éds.), Titre ouvrage (pp. X-Y). Éditeur.
  let inPart = "In";
  const editeurs = ref.editeurs?.trim() || "";
  if (editeurs) {
    inPart += ` ${editeurs}`;
  }

  let ouvrageStr = "";
  if (ref.titre_ouvrage_parent?.trim()) {
    ouvrageStr = italic(ref.titre_ouvrage_parent.trim(), asHtml);
    if (ref.edition?.trim()) {
      ouvrageStr += ` (${ref.edition.trim()})`;
    }
  }

  const pages = ref.pages?.trim() || "";
  if (pages && ouvrageStr) {
    ouvrageStr += ` (pp. ${pages})`;
  }

  const editeurStr = ref.editeur?.trim() || "";
  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(ensurePeriod(titreChapitre));

  let inFull = inPart;
  if (ouvrageStr) {
    inFull += ` ${ouvrageStr}`;
  }
  parts.push(ensurePeriod(inFull));
  if (editeurStr) parts.push(ensurePeriod(editeurStr));
  if (source) parts.push(source);

  return joinParts(parts);
}

function formatRapport(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);
  const titreStr = italic(ref.titre, asHtml);
  const editeurStr = ref.editeur?.trim() || "";
  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(ensurePeriod(titreStr));
  if (editeurStr) parts.push(ensurePeriod(editeurStr));
  if (source) parts.push(source);

  return joinParts(parts);
}

function formatSiteWeb(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);
  const titreStr = italic(ref.titre, asHtml);

  // Pour les sites web, on utilise l'URL avec date de consultation éventuelle
  const editeurStr = ref.editeur?.trim() || "";
  const urlStr = formatURL(ref.url, ref.date_consultation, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(ensurePeriod(titreStr));
  if (editeurStr) parts.push(ensurePeriod(editeurStr));
  if (urlStr) parts.push(urlStr);

  return joinParts(parts);
}

function formatThese(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);
  const titreStr = italic(ref.titre, asHtml);
  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(`${titreStr} [Thèse de doctorat].`);
  if (source) parts.push(source);

  return joinParts(parts);
}

function formatConference(ref: ReferenceBiblio, asHtml: boolean): string {
  const auteur = ref.auteurs?.trim() || "";
  const year = formatYear(ref.annee);
  const titreStr = italic(ref.titre, asHtml);
  const source = formatSource(ref, asHtml);

  const parts: string[] = [];
  if (auteur) parts.push(ensurePeriod(auteur));
  parts.push(`${year}.`);
  parts.push(`${titreStr} [Communication].`);
  if (source) parts.push(source);

  return joinParts(parts);
}

// ─── Fonctions exportées ──────────────────────────────────

/**
 * Formate une référence en citation APA 7.
 * Retourne du HTML (avec <em> pour les italiques, <a> pour les liens).
 */
export function formatAPA7(ref: ReferenceBiblio): string {
  return formatByType(ref, true);
}

/**
 * Formate une référence en citation APA 7 texte brut.
 * Utilisé pour les exports (PDF texte, copie plain text).
 */
export function formatAPA7Plain(ref: ReferenceBiblio): string {
  return formatByType(ref, false);
}

function formatByType(ref: ReferenceBiblio, asHtml: boolean): string {
  switch (ref.type_reference) {
    case "livre":
      return formatLivre(ref, asHtml);
    case "article_revue":
      return formatArticleRevue(ref, asHtml);
    case "chapitre_livre":
      return formatChapitreLivre(ref, asHtml);
    case "rapport":
      return formatRapport(ref, asHtml);
    case "site_web":
      return formatSiteWeb(ref, asHtml);
    case "these":
      return formatThese(ref, asHtml);
    case "conference":
      return formatConference(ref, asHtml);
    default:
      return formatLivre(ref, asHtml);
  }
}

/**
 * Extrait le premier nom de famille pour le tri.
 * Gère les formats "Dupont, J.", "Organisation mondiale" (institutionnel),
 * et le cas sans auteur (tri par titre).
 */
function getSortKey(ref: ReferenceBiblio): string {
  const auteurs = ref.auteurs?.trim() || "";
  if (!auteurs) {
    // Pas d'auteur : on trie par titre
    return ref.titre.trim().toLowerCase();
  }
  // Premier auteur = tout ce qui est avant la première virgule
  // ou le texte entier si pas de virgule (auteur institutionnel)
  const firstComma = auteurs.indexOf(",");
  const lastName = firstComma > 0 ? auteurs.substring(0, firstComma) : auteurs;
  return lastName.trim().toLowerCase();
}

function getSortYear(ref: ReferenceBiblio): number {
  if (!ref.annee) return 9999;
  const num = parseInt(ref.annee, 10);
  return isNaN(num) ? 9999 : num;
}

/**
 * Trie les références par ordre alphabétique (nom du premier auteur),
 * puis par année croissante, conformément aux règles APA 7.
 */
export function sortReferencesAPA7(refs: ReferenceBiblio[]): ReferenceBiblio[] {
  return [...refs].sort((a, b) => {
    const keyA = getSortKey(a);
    const keyB = getSortKey(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    // Même auteur : tri par année
    return getSortYear(a) - getSortYear(b);
  });
}
