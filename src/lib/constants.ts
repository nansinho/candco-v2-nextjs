// Navigation sidebar sections
export const NAV_SECTIONS = [
  {
    title: "Base de contacts",
    items: [
      { label: "Apprenants", href: "/apprenants", icon: "GraduationCap" },
      { label: "Entreprises", href: "/entreprises", icon: "Building2" },
      { label: "Contacts clients", href: "/contacts-clients", icon: "Users" },
      { label: "Formateurs", href: "/formateurs", icon: "UserCheck" },
      { label: "Financeurs", href: "/financeurs", icon: "Landmark" },
    ],
  },
  {
    title: "Catalogue",
    items: [
      { label: "Catalogue de formation", href: "/produits", icon: "BookOpen" },
      { label: "Questionnaires", href: "/questionnaires", icon: "ClipboardList" },
    ],
  },
  {
    title: "Sessions",
    items: [
      { label: "Sessions", href: "/sessions", icon: "Calendar" },
      { label: "Planning", href: "/planning", icon: "CalendarDays" },
    ],
  },
  {
    title: "Suivi d'activité",
    items: [
      { label: "Tâches", href: "/taches", icon: "CheckSquare" },
      { label: "Indicateurs", href: "/indicateurs", icon: "BarChart3" },
    ],
  },
  {
    title: "Suivi commercial",
    items: [
      { label: "Opportunités", href: "/opportunites", icon: "Target" },
      { label: "Devis", href: "/devis", icon: "FileText" },
    ],
  },
  {
    title: "Facturation",
    items: [
      { label: "Factures", href: "/factures", icon: "Receipt" },
      { label: "Avoirs", href: "/avoirs", icon: "FileX" },
      { label: "Export comptable", href: "/export-comptable", icon: "Download" },
    ],
  },
  {
    title: "Divers",
    items: [
      { label: "Tickets", href: "/tickets", icon: "LifeBuoy" },
      { label: "Salles", href: "/salles", icon: "DoorOpen" },
      { label: "Paramètres", href: "/parametres", icon: "Settings" },
    ],
  },
] as const;

// Entity prefixes for display IDs
export const ENTITY_PREFIXES = {
  apprenant: "APP",
  entreprise: "ENT",
  contact_client: "CTC",
  formateur: "FOR",
  financeur: "FIN",
  produit: "PROD",
  session: "SES",
  devis: "D",
  facture: "F",
  avoir: "A",
} as const;

// BPF categories for enterprises
export const BPF_CATEGORIES_ENTREPRISE = [
  { code: "C.1", libelle: "Entreprises pour formation salariés" },
  { code: "C.2.a", libelle: "Contrats d'apprentissage" },
  { code: "C.2.b", libelle: "Contrats de professionnalisation" },
  { code: "C.2.c", libelle: "Promotion ou reconversion professionnelle" },
  { code: "C.7", libelle: "Pouvoirs publics (type 1)" },
  { code: "C.8", libelle: "Pouvoirs publics (type 2)" },
  { code: "C.9", libelle: "Contrats personnes" },
  { code: "C.10", libelle: "Contrats autres organismes" },
  { code: "C.11", libelle: "Autres produits formation professionnelle" },
] as const;

// ─── Extranet navigation ─────────────────────────────────

export const EXTRANET_FORMATEUR_NAV = [
  { label: "Tableau de bord", href: "/extranet/formateur", icon: "BarChart3" },
  { label: "Mes sessions", href: "/extranet/formateur/sessions", icon: "Calendar" },
  { label: "Planning", href: "/extranet/formateur/planning", icon: "CalendarDays" },
  { label: "Disponibilit\u00e9s", href: "/extranet/formateur/disponibilites", icon: "Clock" },
  { label: "Documents", href: "/extranet/formateur/documents", icon: "FileText" },
  { label: "Facturation", href: "/extranet/formateur/facturation", icon: "Receipt" },
  { label: "Messagerie", href: "/extranet/formateur/messagerie", icon: "MessageSquare" },
  { label: "Mon profil", href: "/extranet/formateur/profil", icon: "UserCog" },
] as const;

export const EXTRANET_APPRENANT_NAV = [
  { label: "Tableau de bord", href: "/extranet/apprenant", icon: "BarChart3" },
  { label: "Mes sessions", href: "/extranet/apprenant/sessions", icon: "Calendar" },
  { label: "Planning", href: "/extranet/apprenant/planning", icon: "CalendarDays" },
  { label: "\u00c9margement", href: "/extranet/apprenant/emargement", icon: "PenLine" },
  { label: "Documents", href: "/extranet/apprenant/documents", icon: "FileText" },
  { label: "Questionnaires", href: "/extranet/apprenant/questionnaires", icon: "ClipboardList" },
  { label: "Messagerie", href: "/extranet/apprenant/messagerie", icon: "MessageSquare" },
  { label: "Mon profil", href: "/extranet/apprenant/profil", icon: "UserCog" },
] as const;

export const EXTRANET_CLIENT_NAV = [
  { label: "Tableau de bord", href: "/extranet/client", icon: "BarChart3" },
  { label: "Sessions", href: "/extranet/client/sessions", icon: "Calendar" },
  { label: "Devis", href: "/extranet/client/devis", icon: "FileText" },
  { label: "Factures", href: "/extranet/client/factures", icon: "Receipt" },
  { label: "Documents", href: "/extranet/client/documents", icon: "FileText" },
  { label: "Messagerie", href: "/extranet/client/messagerie", icon: "MessageSquare" },
] as const;

// Pagination
export const ITEMS_PER_PAGE = 25;
