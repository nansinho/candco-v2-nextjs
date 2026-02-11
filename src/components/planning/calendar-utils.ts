import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  isWeekend,
  getHours,
  getMinutes,
  parseISO,
  isSameMonth,
} from "date-fns";
import { fr } from "date-fns/locale";
import type { PlanningCreneau } from "@/actions/planning";

// ─── Constants ──────────────────────────────────────────

export const HOUR_START = 7;
export const HOUR_END = 20;
export const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
export const HOUR_HEIGHT_PX = 64; // px per hour in week view

// ─── Session color palette ──────────────────────────────
// Deterministic colors based on session ID

const SESSION_COLORS = [
  { bg: "bg-orange-500/15", border: "border-orange-500/30", text: "text-orange-400", dot: "bg-orange-400" },
  { bg: "bg-blue-500/15", border: "border-blue-500/30", text: "text-blue-400", dot: "bg-blue-400" },
  { bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-400", dot: "bg-emerald-400" },
  { bg: "bg-purple-500/15", border: "border-purple-500/30", text: "text-purple-400", dot: "bg-purple-400" },
  { bg: "bg-pink-500/15", border: "border-pink-500/30", text: "text-pink-400", dot: "bg-pink-400" },
  { bg: "bg-cyan-500/15", border: "border-cyan-500/30", text: "text-cyan-400", dot: "bg-cyan-400" },
  { bg: "bg-amber-500/15", border: "border-amber-500/30", text: "text-amber-400", dot: "bg-amber-400" },
  { bg: "bg-rose-500/15", border: "border-rose-500/30", text: "text-rose-400", dot: "bg-rose-400" },
  { bg: "bg-indigo-500/15", border: "border-indigo-500/30", text: "text-indigo-400", dot: "bg-indigo-400" },
  { bg: "bg-teal-500/15", border: "border-teal-500/30", text: "text-teal-400", dot: "bg-teal-400" },
];

export function getSessionColor(sessionId: string) {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

// ─── Type badges ────────────────────────────────────────

export const TYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  presentiel: { label: "Presentiel", icon: "MapPin" },
  distanciel: { label: "Distanciel", icon: "Monitor" },
  elearning: { label: "E-learning", icon: "Laptop" },
  stage: { label: "Stage", icon: "Briefcase" },
};

// ─── Date helpers ───────────────────────────────────────

export function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

export function getMonthDays(date: Date): Date[] {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
}

export function getWeekRange(date: Date) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
}

export function getMonthRange(date: Date) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
  return { start, end };
}

export function navigateDate(date: Date, direction: "prev" | "next", view: "week" | "month"): Date {
  if (view === "week") {
    return direction === "prev" ? subWeeks(date, 1) : addWeeks(date, 1);
  }
  return direction === "prev" ? subMonths(date, 1) : addMonths(date, 1);
}

export function formatWeekLabel(date: Date): string {
  const { start, end } = getWeekRange(date);
  const startStr = format(start, "d MMM", { locale: fr });
  const endStr = format(end, "d MMM yyyy", { locale: fr });
  return `${startStr} — ${endStr}`;
}

export function formatMonthLabel(date: Date): string {
  return format(date, "MMMM yyyy", { locale: fr });
}

export function formatDayHeader(date: Date): { dayName: string; dayNum: string } {
  return {
    dayName: format(date, "EEE", { locale: fr }),
    dayNum: format(date, "d"),
  };
}

// ─── Creneau position helpers ───────────────────────────

export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h + m / 60;
}

export function getCreneauPosition(creneau: PlanningCreneau) {
  const startTime = parseTime(creneau.heure_debut);
  const endTime = parseTime(creneau.heure_fin);

  const top = (startTime - HOUR_START) * HOUR_HEIGHT_PX;
  const height = Math.max((endTime - startTime) * HOUR_HEIGHT_PX, 20);

  return { top, height };
}

// ─── Group creneaux by day ──────────────────────────────

export function groupCreneauxByDay(creneaux: PlanningCreneau[]): Map<string, PlanningCreneau[]> {
  const map = new Map<string, PlanningCreneau[]>();
  for (const c of creneaux) {
    const key = c.date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return map;
}

// ─── Format duration ────────────────────────────────────

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Format decimal hours (e.g. 14.5) into "14h30" format.
 * Returns "" if value is null/undefined/0.
 */
export function formatHoursMinutes(hours: number | null | undefined): string {
  if (!hours) return "";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}

/**
 * Split decimal hours into { hours, minutes } for form inputs.
 */
export function splitHoursMinutes(decimalHours: number | null | undefined): { hours: number; minutes: number } {
  if (!decimalHours) return { hours: 0, minutes: 0 };
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  return { hours: h, minutes: m };
}

export function formatTimeRange(debut: string, fin: string): string {
  return `${debut.slice(0, 5)} — ${fin.slice(0, 5)}`;
}

// Re-export date-fns helpers for convenience
export {
  format,
  isSameDay,
  isToday,
  isWeekend,
  isSameMonth,
  parseISO,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
};
export { fr };
