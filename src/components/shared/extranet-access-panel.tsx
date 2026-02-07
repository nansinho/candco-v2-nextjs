"use client";

import * as React from "react";
import {
  Globe,
  UserPlus,
  UserX,
  Loader2,
  Mail,
  Check,
  Clock,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useConfirm } from "@/components/ui/alert-dialog";
import {
  inviteToExtranet,
  revokeExtranetAccess,
  getExtranetAccess,
} from "@/actions/extranet";

interface ExtranetAccessPanelProps {
  entiteType: "formateur" | "apprenant" | "contact_client";
  entiteId: string;
  email: string | null;
  prenom: string;
  nom: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  invite: {
    label: "Invitation envoyee",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  en_attente: {
    label: "En attente",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: Clock,
  },
  actif: {
    label: "Actif",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: Check,
  },
  desactive: {
    label: "Desactive",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: XCircle,
  },
};

const ROLE_LABELS: Record<string, string> = {
  formateur: "Formateur",
  apprenant: "Apprenant",
  contact_client: "Contact client",
};

export function ExtranetAccessPanel({
  entiteType,
  entiteId,
  email,
  prenom,
  nom,
}: ExtranetAccessPanelProps) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isInviting, setIsInviting] = React.useState(false);
  const [isRevoking, setIsRevoking] = React.useState(false);
  const [acces, setAcces] = React.useState<{
    id: string;
    user_id: string;
    role: string;
    statut: string;
    invite_le: string | null;
    active_le: string | null;
  } | null>(null);

  const loadAccess = React.useCallback(async () => {
    setIsLoading(true);
    const result = await getExtranetAccess(entiteType, entiteId);
    if ("acces" in result) {
      setAcces(result.acces ?? null);
    }
    setIsLoading(false);
  }, [entiteType, entiteId]);

  React.useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const handleInvite = async () => {
    if (!email) {
      toast({
        title: "Email requis",
        description:
          "Veuillez d'abord renseigner l'email de cette personne avant de l'inviter.",
        variant: "destructive",
      });
      return;
    }

    setIsInviting(true);
    const result = await inviteToExtranet({
      entiteType,
      entiteId,
      email,
      prenom,
      nom,
    });
    setIsInviting(false);

    if (result.error) {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Invitation envoyee",
      description: `Un compte a ete cree pour ${prenom} ${nom}. L'acces extranet ${ROLE_LABELS[entiteType]} est actif.`,
      variant: "success",
    });
    loadAccess();
  };

  const handleRevoke = async () => {
    if (!acces) return;
    const confirmed = await confirm({
      title: "Revoquer l'acces extranet ?",
      description: `${prenom} ${nom} ne pourra plus se connecter a son espace ${ROLE_LABELS[entiteType]}.`,
      confirmLabel: "Revoquer",
      variant: "destructive",
    });
    if (!confirmed) return;

    setIsRevoking(true);
    const result = await revokeExtranetAccess(acces.id);
    setIsRevoking(false);

    if (result.error) {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Acces revoque",
      description: `L'acces extranet de ${prenom} ${nom} a ete desactive.`,
      variant: "success",
    });
    loadAccess();
  };

  const handleReinvite = async () => {
    if (!email) return;
    setIsInviting(true);

    // For re-invite of a desactivated access, we revoke and create fresh
    if (acces && acces.statut === "desactive") {
      // The inviteToExtranet function handles the re-activation case
    }

    const result = await inviteToExtranet({
      entiteType,
      entiteId,
      email,
      prenom,
      nom,
    });
    setIsInviting(false);

    if (result.error) {
      toast({
        title: "Erreur",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Invitation renvoyee",
      description: `L'invitation a ete renvoyee a ${prenom} ${nom}.`,
      variant: "success",
    });
    loadAccess();
  };

  if (isLoading) {
    return (
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Acces extranet</h3>
        </div>
        <div className="h-16 animate-pulse rounded bg-muted/30" />
      </section>
    );
  }

  const statusConfig = acces ? STATUS_CONFIG[acces.statut] : null;

  return (
    <section className="rounded-lg border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Acces extranet</h3>
      </div>

      {!acces || acces.statut === "desactive" ? (
        /* No access or deactivated */
        <div className="space-y-3">
          {acces?.statut === "desactive" && (
            <div className="flex items-center gap-2 rounded-md bg-red-500/5 border border-red-500/20 px-3 py-2">
              <XCircle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-xs text-red-400">
                Acces precedemment revoque
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {email
              ? `Inviter ${prenom} ${nom} (${email}) a son espace ${ROLE_LABELS[entiteType]}.`
              : "Renseignez d'abord un email pour pouvoir inviter cette personne."}
          </p>
          <Button
            size="sm"
            className="h-8 text-xs w-full"
            onClick={acces?.statut === "desactive" ? handleReinvite : handleInvite}
            disabled={!email || isInviting}
          >
            {isInviting ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Invitation en cours...
              </>
            ) : (
              <>
                <UserPlus className="mr-1.5 h-3 w-3" />
                Inviter a l&apos;extranet
              </>
            )}
          </Button>
        </div>
      ) : (
        /* Has access */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Statut</span>
            {statusConfig && (
              <Badge className={`${statusConfig.color} text-[11px]`}>
                <statusConfig.icon className="mr-1 h-3 w-3" />
                {statusConfig.label}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Role</span>
            <span className="text-xs font-medium">{ROLE_LABELS[entiteType]}</span>
          </div>

          {acces.invite_le && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Invite le</span>
              <span className="text-xs">
                {new Date(acces.invite_le).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}

          {acces.active_le && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Active le</span>
              <span className="text-xs">
                {new Date(acces.active_le).toLocaleDateString("fr-FR")}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Email</span>
            <span className="text-xs font-mono">{email}</span>
          </div>

          <div className="flex gap-2 pt-1">
            {acces.statut === "invite" && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1 border-border/60"
                onClick={handleReinvite}
                disabled={isInviting}
              >
                {isInviting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 h-3 w-3" />
                )}
                Renvoyer
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] flex-1 border-border/60 text-destructive hover:bg-destructive/10 hover:border-destructive/30"
              onClick={handleRevoke}
              disabled={isRevoking}
            >
              {isRevoking ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <UserX className="mr-1 h-3 w-3" />
              )}
              Revoquer
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog />
    </section>
  );
}
