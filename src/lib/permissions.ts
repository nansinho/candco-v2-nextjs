/**
 * RBAC — Role-Based Access Control for back-office users
 *
 * Roles: admin, manager, user
 *
 * | Fonctionnalité           | Admin | Manager | User         |
 * |--------------------------|-------|---------|--------------|
 * | CRM (lecture)             | Oui   | Oui     | Oui          |
 * | CRM (création/modif)      | Oui   | Oui     | Non          |
 * | Sessions                  | Oui   | Oui     | Non          |
 * | Devis / Factures          | Oui   | Oui     | Lecture seule |
 * | Paramètres OF             | Oui   | Non     | Non          |
 * | Gérer utilisateurs        | Oui   | Non     | Non          |
 * | Inviter extranet          | Oui   | Oui     | Non          |
 * | Export comptable / BPF    | Oui   | Non     | Non          |
 * | Supprimer des données     | Oui   | Non     | Non          |
 */

export type UserRole = "admin" | "manager" | "user";

export function canRead(_role: UserRole): boolean {
  return true; // All roles can read
}

export function canCreate(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canEdit(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canDelete(role: UserRole): boolean {
  return role === "admin";
}

export function canManageSessions(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageFinances(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canViewFinances(role: UserRole): boolean {
  return true; // All roles can view (read-only for 'user')
}

export function canManageSettings(role: UserRole): boolean {
  return role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "admin";
}

export function canInviteExtranet(role: UserRole): boolean {
  return role === "admin" || role === "manager";
}

export function canExportData(role: UserRole): boolean {
  return role === "admin";
}

export function canArchive(role: UserRole): boolean {
  return role === "admin";
}

/**
 * Check if user has permission, throw if not.
 * Use in Server Actions to protect mutations.
 */
export function requirePermission(role: UserRole, check: (role: UserRole) => boolean, action: string): void {
  if (!check(role)) {
    throw new Error(`Permission refusée : vous n'avez pas le droit de ${action}`);
  }
}
