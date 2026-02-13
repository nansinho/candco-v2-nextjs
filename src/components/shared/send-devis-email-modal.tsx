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
import { Send, Loader2, ChevronDown, ChevronUp, AlertCircle, FileText, BookOpen } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { sendDevisEmail, type SendDevisEmailInput } from "@/actions/devis";

interface SendDevisEmailModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  devisId: string;
  devisNumero: string;
  // Pre-fill data
  contactEmail: string | null;
  contactNom: string | null;
  entrepriseEmail: string | null;
  particulierEmail: string | null;
  // Formation info for default body
  formationIntitule: string | null;
  formationDates: string | null;
  formationLieu: string | null;
  formationDuree: string | null;
  formationModalite: string | null;
  montantTtc: number;
  orgName: string;
  // Whether a produit is linked (for programme checkbox)
  hasProduit: boolean;
  // Callbacks
  onSendSuccess: (statusChanged: boolean) => void;
}

function buildDefaultBody(props: {
  contactNom: string | null;
  devisNumero: string;
  formationIntitule: string | null;
  formationDates: string | null;
  formationLieu: string | null;
  formationDuree: string | null;
  formationModalite: string | null;
  montantTtc: number;
}): string {
  const lines: string[] = [];
  lines.push(`Bonjour${props.contactNom ? ` ${props.contactNom}` : ""},`);
  lines.push("");
  lines.push(`Veuillez trouver ci-joint notre devis ${props.devisNumero}.`);
  lines.push("");

  if (props.formationIntitule) {
    lines.push(`Formation : ${props.formationIntitule}`);
    if (props.formationDates) lines.push(`Dates : ${props.formationDates}`);
    if (props.formationLieu) lines.push(`Lieu : ${props.formationLieu}`);
    if (props.formationDuree) lines.push(`Durée : ${props.formationDuree}`);
    if (props.formationModalite) lines.push(`Modalité : ${props.formationModalite}`);
    if (props.montantTtc > 0) lines.push(`Montant TTC : ${props.montantTtc.toFixed(2)} €`);
    lines.push("");
  }

  lines.push("N'hésitez pas à nous contacter pour toute question.");
  lines.push("");
  lines.push("Cordialement,");

  return lines.join("\n");
}

export function SendDevisEmailModal({
  open,
  onOpenChange,
  devisId,
  devisNumero,
  contactEmail,
  contactNom,
  entrepriseEmail,
  particulierEmail,
  formationIntitule,
  formationDates,
  formationLieu,
  formationDuree,
  formationModalite,
  montantTtc,
  orgName,
  hasProduit,
  onSendSuccess,
}: SendDevisEmailModalProps) {
  const { toast } = useToast();

  const [recipientsInput, setRecipientsInput] = React.useState("");
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [ccInput, setCcInput] = React.useState("");
  const [bccInput, setBccInput] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [attachDevis, setAttachDevis] = React.useState(true);
  const [attachProgramme, setAttachProgramme] = React.useState(false);
  const [isSending, setIsSending] = React.useState(false);

  // Determine best default email
  const defaultEmail = contactEmail || entrepriseEmail || particulierEmail || "";
  const hasEmail = !!defaultEmail;

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setRecipientsInput(defaultEmail);
      setShowCcBcc(false);
      setCcInput("");
      setBccInput("");
      setSubject(
        formationIntitule
          ? `Envoi de votre devis – ${formationIntitule}`
          : `Envoi de votre devis ${devisNumero}`
      );
      setBody(
        buildDefaultBody({
          contactNom,
          devisNumero,
          formationIntitule,
          formationDates,
          formationLieu,
          formationDuree,
          formationModalite,
          montantTtc,
        })
      );
      setAttachDevis(true);
      setAttachProgramme(false);
      setIsSending(false);
    }
  }, [open, defaultEmail, contactNom, devisNumero, formationIntitule, formationDates, formationLieu, formationDuree, formationModalite, montantTtc]);

  // Parse comma-separated emails
  const parseEmails = (input: string): string[] =>
    input
      .split(/[,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

  const canSend =
    recipientsInput.trim().length > 0 &&
    body.trim().length > 0 &&
    subject.trim().length > 0 &&
    (attachDevis || attachProgramme) &&
    !isSending;

  async function handleSend() {
    if (!canSend) return;

    const recipients = parseEmails(recipientsInput);
    const cc = parseEmails(ccInput);
    const bcc = parseEmails(bccInput);

    if (recipients.length === 0) {
      toast({ title: "Erreur", description: "Au moins un destinataire est requis", variant: "destructive" });
      return;
    }

    setIsSending(true);

    const input: SendDevisEmailInput = {
      devisId,
      recipients,
      cc,
      bcc,
      subject: subject.trim(),
      body: body.trim(),
      attachDevisPdf: attachDevis,
      attachProgrammePdf: attachProgramme,
    };

    try {
      const result = await sendDevisEmail(input);

      if ("error" in result && result.error) {
        toast({
          title: "Erreur d'envoi",
          description: result.error,
          variant: "destructive",
        });
        setIsSending(false);
        return;
      }

      toast({
        title: "Email envoyé avec succès",
        description: `Le devis ${devisNumero} a été envoyé à ${recipients.join(", ")}`,
        variant: "success",
      });

      onOpenChange(false);
      onSendSuccess("statusChanged" in result && !!result.statusChanged);
    } catch (err) {
      console.error("Erreur envoi devis email:", err);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue est survenue lors de l'envoi",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Envoyer le devis {devisNumero}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Configurez l&apos;envoi de votre devis par email avec les pièces jointes souhaitées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── No email warning ── */}
          {!hasEmail && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">
                Aucune adresse email trouvée pour le destinataire. Veuillez renseigner un email ci-dessous ou sélectionner un contact client avec un email dans le devis.
              </p>
            </div>
          )}

          {/* ── Destinataires ── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="devis_recipients" className="text-sm">
                Destinataire(s) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="devis_recipients"
                value={recipientsInput}
                onChange={(e) => setRecipientsInput(e.target.value)}
                placeholder="email@exemple.fr (séparez par des virgules pour plusieurs)"
                className="h-9 text-sm border-border/60"
              />
              <p className="text-[11px] text-muted-foreground/60">
                Séparez les adresses par des virgules pour envoyer à plusieurs destinataires.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCcBcc(!showCcBcc)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showCcBcc ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showCcBcc ? "Masquer Cc / Cci" : "Ajouter Cc / Cci"}
            </button>

            {showCcBcc && (
              <div className="space-y-3 pl-2 border-l-2 border-border/40">
                <div className="space-y-1.5">
                  <Label htmlFor="devis_cc" className="text-xs text-muted-foreground">
                    Cc (copie carbone)
                  </Label>
                  <Input
                    id="devis_cc"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    placeholder="email@exemple.fr"
                    className="h-8 text-sm border-border/60"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="devis_bcc" className="text-xs text-muted-foreground">
                    Cci (copie cachée)
                  </Label>
                  <Input
                    id="devis_bcc"
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    placeholder="email@exemple.fr"
                    className="h-8 text-sm border-border/60"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Documents joints ── */}
          <div className="space-y-3">
            <Label className="text-sm">
              Documents joints <span className="text-destructive">*</span>
            </Label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 rounded-md border border-border/60 p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                <input
                  type="checkbox"
                  checked={attachDevis}
                  onChange={(e) => setAttachDevis(e.target.checked)}
                  className="h-4 w-4 rounded border-border/60 accent-[#F97316] cursor-pointer"
                />
                <FileText className="h-4 w-4 text-[#F97316] shrink-0" />
                <div>
                  <p className="text-sm font-medium">Devis (PDF)</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    Le devis {devisNumero} avec mentions légales et détail des prestations
                  </p>
                </div>
              </label>

              <label
                className={`flex items-center gap-3 rounded-md border border-border/60 p-3 transition-colors ${
                  hasProduit ? "cursor-pointer hover:bg-muted/30" : "opacity-50 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={attachProgramme}
                  onChange={(e) => hasProduit && setAttachProgramme(e.target.checked)}
                  disabled={!hasProduit}
                  className="h-4 w-4 rounded border-border/60 accent-[#F97316] cursor-pointer disabled:cursor-not-allowed"
                />
                <BookOpen className="h-4 w-4 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium">Programme de formation (PDF)</p>
                  <p className="text-[11px] text-muted-foreground/60">
                    {hasProduit
                      ? "Le programme détaillé de la formation avec objectifs, prérequis et contenu"
                      : "Aucun produit de formation lié à ce devis — sélectionnez un programme dans le devis pour activer cette option"}
                  </p>
                </div>
              </label>
            </div>

            {!attachDevis && !attachProgramme && (
              <p className="text-xs text-destructive">
                Au moins un document doit être sélectionné.
              </p>
            )}
          </div>

          {/* ── Objet ── */}
          <div className="space-y-1.5">
            <Label htmlFor="devis_subject" className="text-sm">
              Objet <span className="text-destructive">*</span>
            </Label>
            <Input
              id="devis_subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet de l'email..."
              className="h-9 text-sm border-border/60"
            />
          </div>

          {/* ── Corps du message ── */}
          <div className="space-y-1.5">
            <Label htmlFor="devis_body" className="text-sm">
              Message <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="devis_body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full rounded-md border border-border/60 bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
        </div>

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs border-border/60"
            disabled={isSending}
          >
            Annuler
          </Button>
          <Button
            size="sm"
            disabled={!canSend}
            className="h-8 text-xs bg-[#F97316] hover:bg-[#EA580C] text-white"
            onClick={handleSend}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Envoi en cours...
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
