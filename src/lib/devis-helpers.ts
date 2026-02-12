import { format, isSameMonth, isSameYear, addDays, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Compute the quantity for a devis line based on the tariff's pricing unit.
 *
 * - stagiaire / participant → qty = nombre de participants
 * - groupe / forfait → qty = 1
 * - jour → qty = durée en jours (from the product)
 * - heure → qty = durée en heures (from the product)
 */
export function computeQuantiteFromTarif(
  unite: string | null | undefined,
  nombreParticipants: number | undefined,
  dureeJours: number | null | undefined,
  dureeHeures: number | null | undefined,
): number {
  const u = (unite || "").toLowerCase().trim();

  if (u === "stagiaire" || u === "participant") {
    return nombreParticipants && nombreParticipants > 0 ? nombreParticipants : 1;
  }

  if (u === "jour") {
    return dureeJours && dureeJours > 0 ? dureeJours : 1;
  }

  if (u === "heure") {
    return dureeHeures && dureeHeures > 0 ? dureeHeures : 1;
  }

  // 'groupe', 'forfait', or any other unit
  return 1;
}

/**
 * Format an array of dates into a human-readable French string.
 * Groups consecutive dates into ranges.
 *
 * Examples:
 * - [15, 16, 17 mars] → "15-17 mars 2026"
 * - [15, 16, 22 mars] → "15, 16, 22 mars 2026"
 * - [15, 16, 17, 22 mars] → "15-17, 22 mars 2026"
 * - [28, 29, 30 mars, 1, 2 avril] → "28-30 mars, 1-2 avril 2026"
 */
export function formatDatesDisplay(dates: Date[]): string {
  if (dates.length === 0) return "";

  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

  if (sorted.length === 1) {
    return format(sorted[0], "d MMMM yyyy", { locale: fr });
  }

  // Group into consecutive ranges
  const ranges: { start: Date; end: Date }[] = [];
  let currentStart = sorted[0];
  let currentEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const nextDay = addDays(currentEnd, 1);
    if (isSameDay(sorted[i], nextDay)) {
      currentEnd = sorted[i];
    } else {
      ranges.push({ start: currentStart, end: currentEnd });
      currentStart = sorted[i];
      currentEnd = sorted[i];
    }
  }
  ranges.push({ start: currentStart, end: currentEnd });

  // Group ranges by month for compact display
  const lastDate = sorted[sorted.length - 1];
  const allSameMonth = sorted.every((d) => isSameMonth(d, lastDate));
  const allSameYear = sorted.every((d) => isSameYear(d, lastDate));

  if (allSameMonth) {
    // All dates in the same month: "15-17, 22 mars 2026"
    const parts = ranges.map((r) => {
      if (isSameDay(r.start, r.end)) return format(r.start, "d");
      return `${format(r.start, "d")}-${format(r.end, "d")}`;
    });
    return `${parts.join(", ")} ${format(lastDate, "MMMM yyyy", { locale: fr })}`;
  }

  if (allSameYear) {
    // Multiple months, same year: "28-30 mars, 1-2 avril 2026"
    const parts = ranges.map((r) => {
      if (isSameDay(r.start, r.end)) {
        return `${format(r.start, "d MMMM", { locale: fr })}`;
      }
      if (isSameMonth(r.start, r.end)) {
        return `${format(r.start, "d")}-${format(r.end, "d MMMM", { locale: fr })}`;
      }
      return `${format(r.start, "d MMMM", { locale: fr })}-${format(r.end, "d MMMM", { locale: fr })}`;
    });
    return `${parts.join(", ")} ${format(lastDate, "yyyy")}`;
  }

  // Different years (rare): full format for each range
  const parts = ranges.map((r) => {
    if (isSameDay(r.start, r.end)) {
      return format(r.start, "d MMMM yyyy", { locale: fr });
    }
    return `${format(r.start, "d MMMM yyyy", { locale: fr })}-${format(r.end, "d MMMM yyyy", { locale: fr })}`;
  });
  return parts.join(", ");
}
