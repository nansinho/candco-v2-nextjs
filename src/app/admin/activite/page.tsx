"use client";

import * as React from "react";
import {
  Activity,
  Building2,
  GraduationCap,
  UserCheck,
  Calendar,
  LifeBuoy,
  BookOpen,
  FileText,
  ClipboardList,
} from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { getAdminActivity, getAdminOrgsList, type AdminActivityRow } from "@/actions/admin";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

// ─── Module icons & colors ───────────────────────────────

const MODULE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  entreprise: { label: "Entreprise", icon: Building2, color: "text-blue-400" },
  apprenant: { label: "Apprenant", icon: GraduationCap, color: "text-amber-400" },
  formateur: { label: "Formateur", icon: UserCheck, color: "text-cyan-400" },
  session: { label: "Session", icon: Calendar, color: "text-emerald-400" },
  ticket: { label: "Ticket", icon: LifeBuoy, color: "text-orange-400" },
  produit: { label: "Produit", icon: BookOpen, color: "text-pink-400" },
  questionnaire: { label: "Questionnaire", icon: ClipboardList, color: "text-violet-400" },
  devis: { label: "Devis", icon: FileText, color: "text-blue-400" },
  facture: { label: "Facture", icon: FileText, color: "text-emerald-400" },
  contact_client: { label: "Contact", icon: Building2, color: "text-cyan-400" },
  financeur: { label: "Financeur", icon: Building2, color: "text-violet-400" },
  inscription: { label: "Inscription", icon: GraduationCap, color: "text-amber-400" },
  salle: { label: "Salle", icon: Building2, color: "text-zinc-400" },
  organisation: { label: "Organisation", icon: Building2, color: "text-blue-400" },
};

const ACTION_COLORS: Record<string, string> = {
  created: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  updated: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  archived: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  unarchived: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  deleted: "bg-red-500/10 text-red-500 border-red-500/20",
  status_changed: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  linked: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  unlinked: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  sent: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  signed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  completed: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  replied: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  assigned: "bg-violet-500/10 text-violet-500 border-violet-500/20",
};

// ─── Columns ─────────────────────────────────────────────

const columns: Column<AdminActivityRow>[] = [
  {
    key: "created_at",
    label: "Date",
    sortable: true,
    minWidth: 140,
    render: (item) => (
      <div className="text-sm">
        <span className="text-muted-foreground">
          {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}
        </span>
      </div>
    ),
  },
  {
    key: "module",
    label: "Module",
    sortable: true,
    minWidth: 130,
    filterType: "select",
    filterOptions: Object.entries(MODULE_CONFIG).map(([value, { label }]) => ({ label, value })),
    render: (item) => {
      const config = MODULE_CONFIG[item.module];
      if (!config) return <span className="text-sm">{item.module}</span>;
      const Icon = config.icon;
      return (
        <div className="flex items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
          <span className="text-sm">{config.label}</span>
        </div>
      );
    },
  },
  {
    key: "action",
    label: "Action",
    sortable: true,
    minWidth: 120,
    render: (item) => (
      <Badge variant="outline" className={ACTION_COLORS[item.action] || ""}>
        {item.action}
      </Badge>
    ),
  },
  {
    key: "description",
    label: "Description",
    minWidth: 280,
    render: (item) => (
      <span className="text-sm text-muted-foreground/80 line-clamp-1">
        {item.description || item.entite_label || "—"}
      </span>
    ),
  },
  {
    key: "user_nom",
    label: "Utilisateur",
    sortable: true,
    minWidth: 140,
    render: (item) => (
      <div className="text-sm">
        <span>{item.user_nom || "Système"}</span>
        {item.user_role && (
          <span className="ml-1 text-xs text-muted-foreground">({item.user_role})</span>
        )}
      </div>
    ),
  },
  {
    key: "agence_nom",
    label: "Organisation",
    minWidth: 160,
    render: (item) =>
      item.agence_nom ? (
        <div className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3 text-blue-400" />
          <span className="text-sm">{item.agence_nom}</span>
        </div>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
  },
  {
    key: "origine",
    label: "Origine",
    minWidth: 100,
    defaultVisible: false,
    render: (item) => (
      <span className="text-xs text-muted-foreground">{item.origine}</span>
    ),
  },
];

// ─── Page ────────────────────────────────────────────────

export default function AdminActivitePage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<AdminActivityRow[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);

  // Debounce search (not used for activity but keep for consistency)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch data
  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAdminActivity(page);
      setData(result.data);
      setTotalCount(result.count);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <DataTable
      title="Journal d'activité"
      tableId="admin-activite"
      columns={columns}
      data={data}
      totalCount={totalCount}
      page={page}
      onPageChange={setPage}
      getRowId={(item) => item.id}
      isLoading={isLoading}
      exportFilename="activite-admin"
    />
  );
}
