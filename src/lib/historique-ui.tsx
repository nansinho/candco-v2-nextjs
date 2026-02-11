import {
  Building2,
  GraduationCap,
  Users,
  User,
  Banknote,
  BookOpen,
  Calendar,
  FileText,
  CreditCard,
  CheckSquare,
  MessageSquarePlus,
  DoorOpen,
  Mail,
  HelpCircle,
  Briefcase,
  Clock,
  File,
} from "lucide-react";
import type { HistoriqueModule, HistoriqueAction, HistoriqueOrigine } from "@/lib/historique";

// ─── Module configuration ──────────────────────────────

export const MODULE_CONFIG: Record<
  HistoriqueModule,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  entreprise: {
    label: "Entreprise",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    icon: Building2,
  },
  apprenant: {
    label: "Apprenant",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/15",
    icon: GraduationCap,
  },
  contact_client: {
    label: "Contact",
    color: "text-amber-400",
    bgColor: "bg-amber-500/15",
    icon: Users,
  },
  formateur: {
    label: "Formateur",
    color: "text-teal-400",
    bgColor: "bg-teal-500/15",
    icon: User,
  },
  financeur: {
    label: "Financeur",
    color: "text-lime-400",
    bgColor: "bg-lime-500/15",
    icon: Banknote,
  },
  produit: {
    label: "Produit",
    color: "text-violet-400",
    bgColor: "bg-violet-500/15",
    icon: BookOpen,
  },
  session: {
    label: "Session",
    color: "text-purple-400",
    bgColor: "bg-purple-500/15",
    icon: Calendar,
  },
  inscription: {
    label: "Inscription",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/15",
    icon: GraduationCap,
  },
  devis: {
    label: "Devis",
    color: "text-sky-400",
    bgColor: "bg-sky-500/15",
    icon: FileText,
  },
  facture: {
    label: "Facture",
    color: "text-green-400",
    bgColor: "bg-green-500/15",
    icon: CreditCard,
  },
  avoir: {
    label: "Avoir",
    color: "text-red-400",
    bgColor: "bg-red-500/15",
    icon: CreditCard,
  },
  tache: {
    label: "Tâche",
    color: "text-pink-400",
    bgColor: "bg-pink-500/15",
    icon: CheckSquare,
  },
  activite: {
    label: "Activité",
    color: "text-blue-400",
    bgColor: "bg-blue-500/15",
    icon: MessageSquarePlus,
  },
  salle: {
    label: "Salle",
    color: "text-stone-400",
    bgColor: "bg-stone-500/15",
    icon: DoorOpen,
  },
  email: {
    label: "Email",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/15",
    icon: Mail,
  },
  organisation: {
    label: "Organisation",
    color: "text-orange-400",
    bgColor: "bg-orange-500/15",
    icon: Building2,
  },
  questionnaire: {
    label: "Questionnaire",
    color: "text-fuchsia-400",
    bgColor: "bg-fuchsia-500/15",
    icon: HelpCircle,
  },
  opportunite: {
    label: "Opportunité",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/15",
    icon: Briefcase,
  },
  ticket: {
    label: "Ticket",
    color: "text-rose-400",
    bgColor: "bg-rose-500/15",
    icon: Clock,
  },
  document: {
    label: "Document",
    color: "text-slate-400",
    bgColor: "bg-slate-500/15",
    icon: File,
  },
};

// ─── Action labels ─────────────────────────────────────

export const ACTION_LABELS: Record<HistoriqueAction, string> = {
  created: "Création",
  updated: "Modification",
  archived: "Archivage",
  unarchived: "Désarchivage",
  deleted: "Suppression",
  status_changed: "Changement de statut",
  linked: "Association",
  unlinked: "Dissociation",
  imported: "Import",
  sent: "Envoi",
  signed: "Signature",
  completed: "Terminé",
  generated: "Génération",
  replied: "Réponse",
  assigned: "Assignation",
  alert_triggered: "Alerte budget",
};

// ─── Action colors (for badge styling) ─────────────────

export const ACTION_COLORS: Record<HistoriqueAction, string> = {
  created: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  updated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  unarchived: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  deleted: "bg-red-500/10 text-red-500 border-red-500/20",
  status_changed: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  linked: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  unlinked: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  imported: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  signed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  generated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  replied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  assigned: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  alert_triggered: "bg-red-500/10 text-red-500 border-red-500/20",
};

// ─── Origine labels ────────────────────────────────────

export const ORIGINE_LABELS: Record<HistoriqueOrigine, { label: string; class: string }> = {
  backoffice: {
    label: "Back-office",
    class: "border-transparent bg-gray-500/15 text-gray-400",
  },
  extranet: {
    label: "Extranet",
    class: "border-transparent bg-indigo-500/15 text-indigo-400",
  },
  systeme: {
    label: "Système",
    class: "border-transparent bg-gray-500/10 text-gray-500",
  },
};

// ─── Role labels ───────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Manager",
  user: "Utilisateur",
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact client",
};

// ─── Helpers ───────────────────────────────────────────

export function getModuleIcon(module: HistoriqueModule) {
  const config = MODULE_CONFIG[module];
  if (!config) return <Clock className="h-3.5 w-3.5" />;
  const Icon = config.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatChangedFields(metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const fields = metadata.changed_fields as string[] | undefined;
  if (!fields || fields.length === 0) return null;
  return fields.join(", ");
}
