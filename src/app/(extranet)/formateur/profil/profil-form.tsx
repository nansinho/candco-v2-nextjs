"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface FormateurData {
  id: string;
  numero_affichage: string;
  civilite: string | null;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse_rue: string | null;
  adresse_complement: string | null;
  adresse_cp: string | null;
  adresse_ville: string | null;
  statut_bpf: string;
  nda: string | null;
  siret: string | null;
}

export function FormateurProfilForm({ formateur }: { formateur: FormateurData }) {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Mon profil</h1>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] font-mono">
            {formateur.numero_affichage}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Vos informations personnelles et professionnelles
        </p>
      </div>

      {/* Identity */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Identite</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-[13px]">Civilite</Label>
            <Input value={formateur.civilite ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Prenom</Label>
            <Input value={formateur.prenom} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Nom</Label>
            <Input value={formateur.nom} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Contact</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label className="text-[13px]">Email</Label>
            <Input value={formateur.email ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">Telephone</Label>
            <Input value={formateur.telephone ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      {/* Address */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Adresse</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[13px]">Rue</Label>
            <Input value={formateur.adresse_rue ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[13px]">Code postal</Label>
              <Input value={formateur.adresse_cp ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px]">Ville</Label>
              <Input value={formateur.adresse_ville ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
            </div>
          </div>
        </div>
      </section>

      {/* Professional */}
      <section className="rounded-lg border border-border/60 bg-card p-5">
        <h3 className="mb-4 text-sm font-semibold">Informations professionnelles</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label className="text-[13px]">Statut</Label>
            <Badge className={formateur.statut_bpf === "interne"
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
            }>
              {formateur.statut_bpf === "interne" ? "Interne (salarie)" : "Externe (sous-traitant)"}
            </Badge>
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">NDA</Label>
            <Input value={formateur.nda ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-[13px]">SIRET</Label>
            <Input value={formateur.siret ?? ""} disabled className="h-9 text-[13px] border-border/60 bg-muted/50" />
          </div>
        </div>
      </section>

      <p className="text-xs text-muted-foreground/40">
        Pour modifier vos informations, contactez l&apos;administrateur de l&apos;organisme de formation.
      </p>
    </div>
  );
}
