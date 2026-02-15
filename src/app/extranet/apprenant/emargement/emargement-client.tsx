"use client";

import * as React from "react";
import { PenTool, Check, Clock, MapPin, Calendar, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type ApprenantEmargementCreneau,
  signEmargement,
} from "@/actions/extranet-context";
import { formatTimeRange, formatDuration } from "@/components/planning/calendar-utils";

// ─── Signature Pad ──────────────────────────────────────

function SignaturePad({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [hasStrokes, setHasStrokes] = React.useState(false);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#FAFAFA";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasStrokes(true);
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg border-2 border-dashed border-border/60 bg-muted/10 overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full h-[150px] cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
        {!hasStrokes && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-muted-foreground/40">Signez ici</p>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={clear}
            disabled={!hasStrokes || saving}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Effacer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={onCancel}
            disabled={saving}
          >
            Annuler
          </Button>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={save}
          disabled={!hasStrokes || saving}
        >
          {saving ? "Envoi..." : "Valider ma presence"}
        </Button>
      </div>
    </div>
  );
}

// ─── Creneau card ───────────────────────────────────────

function CreneauCard({
  creneau,
  apprenantId,
  onSigned,
}: {
  creneau: ApprenantEmargementCreneau;
  apprenantId: string;
  onSigned: (creneauId: string) => void;
}) {
  const [showPad, setShowPad] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isSigned = !!creneau.emargement;
  const isOpen = creneau.emargement_ouvert && !isSigned;

  const handleSign = async (dataUrl: string) => {
    setSaving(true);
    setError(null);
    const result = await signEmargement(apprenantId, creneau.id, dataUrl);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setShowPad(false);
      onSigned(creneau.id);
    }
  };

  const dateLabel = new Date(creneau.date + "T00:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div
      className={cn(
        "rounded-lg border bg-card overflow-hidden transition-colors",
        isOpen ? "border-emerald-500/30 bg-emerald-500/[0.03]" : "border-border/60",
        isSigned && "border-blue-500/30 bg-blue-500/[0.03]"
      )}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Status icon */}
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
            isSigned
              ? "bg-blue-500/10"
              : isOpen
                ? "bg-emerald-500/10"
                : "bg-muted/30"
          )}
        >
          {isSigned ? (
            <Check className="h-4 w-4 text-blue-400" />
          ) : isOpen ? (
            <PenTool className="h-4 w-4 text-emerald-400" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{creneau.session.nom}</p>
            <Badge variant="outline" className="text-xs border-border/60 py-0">
              {creneau.session.numero_affichage}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1 capitalize">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeRange(creneau.heure_debut, creneau.heure_fin)}
              {creneau.duree_minutes && (
                <span className="text-muted-foreground/40">
                  ({formatDuration(creneau.duree_minutes)})
                </span>
              )}
            </span>
            {creneau.salle && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {creneau.salle.nom}
              </span>
            )}
          </div>
        </div>

        {/* Action */}
        {isSigned ? (
          <div className="text-right shrink-0">
            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs">
              Signe
            </Badge>
            {creneau.emargement?.heure_signature && (
              <p className="text-xs text-muted-foreground/40 mt-0.5">
                {new Date(creneau.emargement.heure_signature).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        ) : isOpen ? (
          <Button
            size="sm"
            className="h-8 text-xs shrink-0"
            onClick={() => setShowPad(true)}
          >
            <PenTool className="h-3.5 w-3.5 mr-1" />
            Signer
          </Button>
        ) : (
          <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground/40 shrink-0">
            Ferme
          </Badge>
        )}
      </div>

      {/* Signature pad */}
      {showPad && (
        <div className="border-t border-border/40 px-4 py-3">
          {error && (
            <div className="mb-3 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          <SignaturePad
            onSave={handleSign}
            onCancel={() => setShowPad(false)}
            saving={saving}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────

export function EmargementClient({
  apprenantId,
  initialCreneaux,
}: {
  apprenantId: string;
  initialCreneaux: ApprenantEmargementCreneau[];
}) {
  const [creneaux, setCreneaux] = React.useState(initialCreneaux);

  const handleSigned = (creneauId: string) => {
    setCreneaux((prev) =>
      prev.map((c) =>
        c.id === creneauId
          ? {
              ...c,
              emargement: {
                id: "temp",
                present: true,
                signature_url: null,
                heure_signature: new Date().toISOString(),
              },
            }
          : c
      )
    );
  };

  // Split into open (to sign) and signed
  const openCreneaux = creneaux.filter((c) => c.emargement_ouvert && !c.emargement);
  const signedCreneaux = creneaux.filter((c) => !!c.emargement);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
            <PenTool className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground/60">A signer</p>
            <p className="text-sm font-semibold font-mono">{openCreneaux.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-card px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 shrink-0">
            <Check className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground/60">Signes</p>
            <p className="text-sm font-semibold font-mono">{signedCreneaux.length}</p>
          </div>
        </div>
      </div>

      {/* Open creneaux */}
      {openCreneaux.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-emerald-400">
            Creneaux ouverts a l&apos;emargement
          </h2>
          {openCreneaux.map((c) => (
            <CreneauCard
              key={c.id}
              creneau={c}
              apprenantId={apprenantId}
              onSigned={handleSigned}
            />
          ))}
        </div>
      )}

      {/* Signed creneaux */}
      {signedCreneaux.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground/60">
            Historique des emargements
          </h2>
          {signedCreneaux.map((c) => (
            <CreneauCard
              key={c.id}
              creneau={c}
              apprenantId={apprenantId}
              onSigned={handleSigned}
            />
          ))}
        </div>
      )}

      {/* Empty */}
      {creneaux.length === 0 && (
        <div className="rounded-lg border border-border/60 bg-card p-12 text-center">
          <PenTool className="mx-auto h-10 w-10 text-muted-foreground/20" />
          <p className="mt-3 text-sm font-medium text-muted-foreground/60">
            Aucun creneau ouvert a l&apos;emargement
          </p>
          <p className="mt-1 text-xs text-muted-foreground/40">
            Quand un creneau sera ouvert par le formateur, vous pourrez signer votre presence ici.
          </p>
        </div>
      )}
    </div>
  );
}
