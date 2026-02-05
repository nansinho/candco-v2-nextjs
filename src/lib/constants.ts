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
    title: "Bibliothèque",
    items: [
      { label: "Produits de formation", href: "/produits", icon: "BookOpen" },
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

// Pagination
export const ITEMS_PER_PAGE = 25;
