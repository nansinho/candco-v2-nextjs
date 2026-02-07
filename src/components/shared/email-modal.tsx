"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Send, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

interface EmailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTo?: string;
  defaultSubject?: string;
  /** Context label shown in the dialog (e.g. entity name) */
  contextLabel?: string;
}

export function EmailModal({
  open,
  onOpenChange,
  defaultTo = "",
  defaultSubject = "",
  contextLabel,
}: EmailModalProps) {
  const { toast } = useToast();
  const [to, setTo] = React.useState(defaultTo);
  const [subject, setSubject] = React.useState(defaultSubject);
  const [body, setBody] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setBody("");
      setIsSending(false);
    }
  }, [open, defaultTo, defaultSubject]);

  function handleSend() {
    if (!to.trim()) return;

    setIsSending(true);

    // Build mailto URL with subject and body
    const params = new URLSearchParams();
    if (subject) params.set("subject", subject);
    if (body) params.set("body", body);

    const mailtoUrl = `mailto:${encodeURIComponent(to)}${params.toString() ? `?${params.toString()}` : ""}`;
    window.open(mailtoUrl, "_blank");

    toast({
      title: "Email préparé",
      description: "Votre client email s'est ouvert avec le message pré-rempli.",
      variant: "success",
    });

    setIsSending(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Envoyer un email</DialogTitle>
          <DialogDescription>
            {contextLabel
              ? `Envoyez un email rapide à ${contextLabel}.`
              : "Composez et envoyez un email rapide."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email_to" className="text-[13px]">
              Destinataire <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email_to"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@exemple.fr"
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_subject" className="text-[13px]">
              Objet
            </Label>
            <Input
              id="email_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email..."
              className="h-9 text-[13px] border-border/60"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_body" className="text-[13px]">
              Message
            </Label>
            <textarea
              id="email_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Votre message..."
              rows={6}
              className="w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs border-border/60"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={isSending || !to.trim()}
            className="h-8 text-xs"
            onClick={handleSend}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Envoi...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-3 w-3" />
                Envoyer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
