"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  Mail,
  Phone,
  Copy,
} from "lucide-react";

export interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "ghost";
  hidden?: boolean;
}

interface QuickActionsBarProps {
  email?: string | null;
  telephone?: string | null;
  /** Additional custom actions */
  actions?: QuickAction[];
}

export function QuickActionsBar({ email, telephone, actions = [] }: QuickActionsBarProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copié",
      description: `${label} copié dans le presse-papiers.`,
      variant: "success",
    });
  };

  const hasAnyAction = email || telephone || actions.filter((a) => !a.hidden).length > 0;
  if (!hasAnyAction) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {email && (
        <>
          <a href={`mailto:${email}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-border/60 text-muted-foreground hover:text-foreground gap-1.5"
            >
              <Mail className="h-3 w-3" />
              Email
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => copyToClipboard(email, "Email")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </>
      )}

      {telephone && (
        <>
          <a href={`tel:${telephone}`}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-border/60 text-muted-foreground hover:text-foreground gap-1.5"
            >
              <Phone className="h-3 w-3" />
              Appeler
            </Button>
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1"
            onClick={() => copyToClipboard(telephone, "Téléphone")}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </>
      )}

      {(email || telephone) && actions.filter((a) => !a.hidden).length > 0 ? (
        <div className="h-4 w-px bg-border/60 mx-1" />
      ) : null}

      {actions
        .filter((a) => !a.hidden)
        .map((action) => {
          if (action.href) {
            return (
              <a key={action.label} href={action.href} target="_blank" rel="noopener noreferrer">
                <Button
                  variant={action.variant ?? "outline"}
                  size="sm"
                  className="h-7 text-[11px] border-border/60 text-muted-foreground hover:text-foreground gap-1.5"
                >
                  {action.icon}
                  {action.label}
                </Button>
              </a>
            );
          }
          return (
            <Button
              key={action.label}
              variant={action.variant ?? "outline"}
              size="sm"
              className="h-7 text-[11px] border-border/60 text-muted-foreground hover:text-foreground gap-1.5"
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </Button>
          );
        })}
    </div>
  );
}
