# 🏗️ PLAN COMPLET — C&CO Formation v2 (Clone SmartOF Amélioré)

> **Document de référence pour Claude Code**
> Dernière mise à jour : 7 février 2026
> Auteur : Nans (C&CO Formation)

---

## TABLE DES MATIÈRES

1. [Vision du projet](#1-vision-du-projet)
2. [Stack technique](#2-stack-technique)
3. [Architecture (2 domaines, 3 couches)](#3-architecture)
4. [Modules fonctionnels (15 documentés)](#4-modules-fonctionnels)
4B. [Accès utilisateurs & Rôles](#4b-accès-utilisateurs--rôles)
5. [Schéma BDD v2](#5-schéma-bdd-v2)
6. [Design System](#6-design-system)
7. [Roadmap par phases (16 phases)](#7-roadmap-par-phases)
8. [Instructions pour Claude Code](#8-instructions-pour-claude-code)
9. [Modules non documentés (à prévoir)](#9-modules-non-documentés)
10. [Features killer (avantages vs SmartOF)](#10-features-killer)

---

## 1. VISION DU PROJET

**Objectif** : Créer une plateforme SaaS de gestion d'Organisme de Formation (OF), inspirée de SmartOF en mieux, pour C&CO Formation et ses clients OF.

**C&CO est deux choses à la fois :**
1. **Un organisme de formation** (C&CO Formation) qui a besoin de gérer ses propres formations
2. **Un éditeur de logiciel SaaS** qui propose sa plateforme à d'autres OF

**Contexte** :
- L'ancienne app (Lovable + Supabase Cloud) avait ~60 tables et 63 Edge Functions → trop complexe, non maintenable
- On repart **de zéro** : nouvelle BDD, nouveau front, nouvelle architecture
- Le logiciel actuel SmartOF est la référence fonctionnelle → on le copie et on l'améliore
- **Multi-tenant** : le système doit supporter plusieurs organismes de formation
- **Deux domaines** : `candco.fr` (site vitrine C&CO) + `app.candco.fr` (plateforme SaaS)
- **Vitrines par OF** : chaque OF client peut avoir son propre site vitrine connecté à la BDD

**Ce qu'on garde de l'ancienne app C&CO** :
- Import PDF → remplissage auto du programme de formation (SmartOF n'a pas ça)
- Images IA pour les formations
- Barre de progression de complétion des fiches (95%, 2 manquants)

---

## 2. STACK TECHNIQUE

| Composant | Technologie | Notes |
|-----------|-------------|-------|
| **Framework** | Next.js 16 (dernière version stable) | App Router, Turbopack, PPR |
| **React** | React 19.2 | View Transitions, useEffectEvent, Activity |
| **BDD** | Supabase Self-Hosted (Postgres) | Sur VPS Coolify |
| **Auth** | Supabase Auth | Multi-tenant, rôles |
| **Storage** | Supabase Storage | Documents, PDFs, images |
| **Realtime** | Supabase Realtime | Notifications, mises à jour live |
| **Emails** | Resend | Templates, relances, tracking |
| **Tâches planifiées** | pg_cron (Postgres) | Rappels, relances automatiques |
| **Génération docs** | pdf-lib / docx-templates | Côté API Routes Next.js |
| **Hébergement** | VPS Coolify | Next.js + Supabase self-hosted |
| **Code source** | GitHub | CI/CD via Coolify |
| **Edge Functions** | 0 (sauf exception webhook) | Tout en API Routes / Server Actions |

### Architecture Next.js 16

```
Next.js 16 + React 19.2
├── Turbopack (bundler par défaut)
├── App Router + Cache Components + PPR
├── Server Actions (mutations BDD)
├── API Routes /api/* (webhooks, Resend, génération docs)
├── proxy.ts (remplace middleware — auth, redirections)
└── Supabase self-hosted
    ├── Postgres + pg_cron + RPC
    ├── Auth (JWT, rôles, multi-tenant)
    ├── Storage (documents, PDFs)
    └── Realtime (notifications)
```

---

## 3. ARCHITECTURE

### 3.1 — Vue globale (3 couches, 2 domaines)

```
┌─────────────────────────────────────────────────────────┐
│  COUCHE 1 — VITRINES PUBLIQUES (par OF)                 │
│                                                          │
│  candco.fr              → Vitrine C&CO Formation         │
│  formationabc.fr        → Vitrine d'un OF client         │
│  [slug].candco.app      → Vitrine OF sans domaine custom │
│                                                          │
│  Projet Next.js séparé, multi-tenant par domaine         │
│  Pages : catalogue, fiche formation, inscription, blog   │
├─────────────────────────────────────────────────────────┤
│  COUCHE 2 — PLATEFORME SAAS (app.candco.fr)             │
│                                                          │
│  Projet Next.js principal (ce repo)                      │
│  /             → Landing page "Notre solution"           │
│  /login        → Connexion unique (tous les rôles)       │
│  /dashboard    → Back-office admin OF (multi-tenant)     │
│  /extranet     → Espaces formateurs/apprenants/clients   │
│  /admin        → Vue super-admin (gestion plateforme)    │
├─────────────────────────────────────────────────────────┤
│  COUCHE 3 — BASE DE DONNÉES (Supabase self-hosted)      │
│                                                          │
│  Une seule BDD, multi-tenant par organisation_id         │
│  Toutes les vitrines + la plateforme lisent la même BDD  │
│                                                          │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌────────┐    │
│  │ Postgres │  │  Auth  │  │ Storage  │  │Realtime│    │
│  │ +pg_cron │  │  JWT   │  │  Docs    │  │  WS    │    │
│  │ +RPC     │  │ Rôles  │  │  PDFs    │  │  Chat  │    │
│  └──────────┘  └────────┘  └──────────┘  └────────┘    │
├─────────────────────────────────────────────────────────┤
│               SERVICES EXTERNES                          │
│  Resend (emails) │ API SIRENE (INSEE) │ IA (OpenAI?)    │
└─────────────────────────────────────────────────────────┘
```

### 3.2 — Qui accède à quoi, où

| Qui | Où | Ce qu'il voit |
|-----|-----|---------------|
| Visiteur | `candco.fr` | Catalogue C&CO, blog, inscription sessions |
| Visiteur OF client | `formationabc.fr` | Catalogue de cet OF, inscription |
| Admin / Manager OF | `app.candco.fr/dashboard` | Back-office complet de son OF |
| Formateur | `app.candco.fr/extranet/formateur` | Ses sessions, planning, dispos, facturation, chat |
| Apprenant | `app.candco.fr/extranet/apprenant` | Ses sessions, émargement, docs, certificats, chat |
| Contact client | `app.candco.fr/extranet/client` | Sessions entreprise, devis, factures, docs |
| Super-admin C&CO | `app.candco.fr/admin` | Switch entre toutes les orgs, tickets globaux |

### 3.3 — Détail technique plateforme (app.candco.fr)

```
Next.js 16 + React 19.2
├── Turbopack (bundler par défaut)
├── App Router + Cache Components + PPR
├── Server Actions (mutations BDD)
├── API Routes /api/* (webhooks, Resend, génération docs)
├── Middleware (auth + routing par rôle)
├── 4 route groups :
│   ├── (auth)       → login/register
│   ├── (dashboard)  → back-office admin OF
│   ├── (extranet)   → espaces formateur/apprenant/client
│   └── (admin)      → super-admin plateforme
└── Supabase self-hosted
    ├── Postgres + pg_cron + RPC
    ├── Auth (JWT, rôles, multi-tenant)
    ├── Storage (documents, PDFs)
    └── Realtime (messagerie, notifications)
```

---

## 4. MODULES FONCTIONNELS (15 documentés)

### 4.1 — SIDEBAR / NAVIGATION

**7 sections de menu :**

**Section 1 — Base de contacts (CRM)**
- Apprenants (APP-xxxx)
- Entreprises (ENT-xxxx)
- Contacts clients (CTC-xxxx)
- Formateurs (FOR-xxxx)
- Financeurs (FIN-xxxx)

**Section 2 — Bibliothèque (Catalogue)**
- Produits de formation (PROD-xxxx)
- Questionnaires (fusion pédagogiques + enquêtes satisfaction)

**Section 3 — Sessions**
- Sessions de formation (SES-xxxx)
- Planning (vue calendrier)
- Inscriptions

**Section 4 — Suivi d'activité**
- Tâches
- Indicateurs / Dashboard
- Rapports
- BPF (Bilan Pédagogique et Financier)
- Emails envoyés
- Automatisations

**Section 5 — Suivi commercial**
- Opportunités commerciales
- Devis (D-ANNÉE-xxxx)

**Section 6 — Facturation**
- Factures (F-ANNÉE-xxxx)
- Export comptable
- Avoirs (A-ANNÉE-xxxx)

**Section 7 — Divers**
- Tickets
- Salles
- Formulaires administratifs
- Paramètres

**Conventions d'ID** : Préfixe + compteur auto (APP-0324, ENT-0056, SES-0058, D-2026-0028, F-2026-0015, A-2026-0001)

---

### 4.2 — APPRENANTS (APP)

**Préfixe** : APP-xxxx | **324 apprenants** dans SmartOF

**Pattern liste** (commun à toutes les entités) :
- Recherche + Recherche avancée
- Archives / Exporter / + Ajouter
- Filtres modifiables / Colonnes modifiables
- Vues sauvegardées en onglets (+ créer une vue custom)
- Pagination 25/page
- Sélection multiple → actions groupées (Modifier / Supprimer)
- Colonnes triables avec drag & drop

**Champs apprenant :**
- ID (auto), Civilité, Prénom, Nom, Nom de naissance
- Email, Téléphone, Date de naissance
- Fonction, Lieu d'activité
- Adresse complète (rue, complément, CP, ville)
- Numéro compte comptable
- **Statut BPF** (dropdown codes officiels : F.1.a, F.2, etc.)
- Date de création

**Relations :**
- Entreprise(s) → many-to-many (un apprenant peut être dans plusieurs entreprises)
- Entreprise(s) → champs relationnels visibles (nom, SIRET, email, adresse, BPF, facturation)

**Intégrations futures :**
- Pennylane (ID externe, dates sync)
- LMS (ID externe, dates sync)

---

### 4.3 — ENTREPRISES (ENT)

**Préfixe** : ENT-xxxx | **56 entreprises**

**6 onglets sur la fiche :**

**Onglet 1 — Informations générales :**
- ID (auto), Nom, SIRET
- Email, Téléphone
- Adresse complète
- Provenance BPF (dropdown codes officiels C.1, C.2.a, C.2.b, etc.)
- Numéro compte comptable
- Recherche INSEE (auto-complétion SIRET/SIREN via API SIRENE)
- Configurer la fiche (personnalisation champs)

**Onglet 2 — Informations de facturation :**
- Adresse de facturation SÉPARÉE (raison sociale, adresse complète)
- Bouton "Remplir avec les informations de l'entreprise" (copie auto)

**Onglet 3 — Historique commercial :**
- Opportunités commerciales rattachées
- Devis (numérotation D-ANNÉE-NUMÉRO, statut, montant HT)
- Factures rattachées

**Onglet 4 — Apprenants :**
- Liste des apprenants rattachés (many-to-many)
- + Ajouter un apprenant

**Onglet 5 — Historique des sessions :**
- Sessions liées à l'entreprise (ID, nom, dates, statut)

**Onglet 6 — Tâches et activités :**
- Historique d'activités (+ Ajouter une note — journal CRM)
- Tâches à venir (+ Ajouter une tâche)

**Panneau latéral droit :**
- Tâches programmées
- Contacts clients associés (+ Associer des contacts)

**Codes BPF entreprise (table de référence) :**
- C.1 — entreprises pour formation salariés
- C.2.a — contrats d'apprentissage
- C.2.b — contrats de professionnalisation
- C.2.c — promotion ou reconversion professionnelle
- C.7 — pouvoirs publics (type 1)
- C.8 — pouvoirs publics (type 2)
- C.9 — contrats personnes
- C.10 — contrats autres organismes
- C.11 — Autres produits formation professionnelle

---

### 4.4 — CONTACTS CLIENTS (CTC)

**Préfixe** : CTC-xxxx | **65 contacts**

**Point clé** : Contact client ≠ Apprenant. Le contact est le décideur/commanditaire (responsable formation, DRH, directeur), pas celui qui suit la formation.

**2 onglets :**

**Onglet 1 — Informations générales :**
- Civilité, ID (auto), Prénom, Nom
- Email (+ bouton envoi direct), Téléphone
- Fonction (ex: "Assistant(e) de direction")

**Onglet 2 — Tâches et activités :**
- Historique d'activités + Tâches à venir

**Panneau latéral droit :**
- Tâches programmées
- Entreprises associées (many-to-many — un contact peut gérer plusieurs entreprises)
- Accès extranet (inviter / révoquer / reset MDP)

---

### 4.5 — FORMATEURS (FOR)

**Préfixe** : FOR-xxxx | **16 formateurs**

**4 onglets détail :**

**Onglet 1 — Informations générales :**
- Civilité, ID, Prénom, Nom
- Email, Téléphone
- Adresse complète
- **Statut BPF** : Interne (salarié) / Externe (sous-traitant) — impact direct sur BPF
- **NDA sous-traitant** (Numéro Déclaration d'Activité — obligatoire réglementairement)
- SIRET (pour facturation sous-traitants)
- Compétences (multi-select)
- Lien calendrier iCal

**Panneau latéral droit :**
- Tâches programmées
- **Coût du formateur** : Tarif jour HT (ex: 300 €/jour) + calcul auto heure (÷7h) + Taux TVA
- **Accès extranet** : Compte validé, reset MDP, révoquer

**Onglet 2 — Sessions de formation :**
- Liste des sessions assignées (ID, nom, dates)

**Onglet 3 — Tâches et activités :**
- Historique + Tâches à venir

**Onglet 4 — Documents :**
- Générer un document (contrat sous-traitance, convention, etc.)
- Importer des documents
- Liste (intitulé, catégorie, date)

---

### 4.6 — FINANCEURS (FIN)

**Préfixe** : FIN-xxxx

**Entité séparée des entreprises** — OPCO, Pôle Emploi, Région, etc.

**Champs :**
- ID (auto), Nom du financeur
- Type (OPCO, Pôle Emploi, Région, AGEFIPH, Entreprise, Autre)
- SIRET
- Email, Téléphone
- Adresse complète
- Numéro compte comptable
- Code BPF associé

**Relations :**
- Sessions financées (liste)
- Inscriptions prises en charge
- Historique des paiements

---

### 4.7 — PRODUITS DE FORMATION (PROD)

**Préfixe** : PROD-xxxx

**C'est le catalogue — la "fiche produit" d'une formation.**

**SmartOF — 3 onglets + sous-configurations :**

**Onglet 1 — Configuration :**
- Intitulé, Identifiant interne
- Sous-titre, Description (éditeur riche)
- Domaine / Pôle (dropdown)
- Type d'action (Action de formation, Bilan compétences, VAE, Apprentissage)
- Modalité (Présentiel, Distanciel, Mixte, AFEST)
- Formule (Inter, Intra, Individuel)

**Onglet 2 — Tarifs :**
- Multi-tarifs possibles (ex: prix HT / stagiaire / jour, forfait, etc.)
- Taux TVA (0% = exonéré art. 261-4-4a du CGI)
- Recettes par tarif
- Templates de tarification

**Onglet 3 — Configuration avancée :**
- **BPF** : Spécialité, Catégorie (A/B/C), Niveau (I à V)
- **Catalogue en ligne** : Toggle publication + aperçu
- **Documents** : Templates liés (convention, programme, attestation)
- **Évaluations** : Enquêtes satisfaction + questionnaires péda rattachés
- **Objectifs pédagogiques** : Grille Acquis / En cours / Non acquis
- **Ressources pédagogiques** : Fichiers partagés via extranet

**App C&CO actuelle (à garder) :**
- 5 onglets : Général, Pratique, Objectifs, Programme, Modalités, Indicateurs
- **Import PDF IA → remplissage auto du programme** ← avantage concurrentiel !
- **Images IA** pour les formations
- **Barre de progression** de complétion (95%, 2 manquants)
- Toggle publication + slug URL + image

**Notre v2 fusionne le meilleur des deux :**

| Feature | SmartOF | C&CO | Notre v2 |
|---------|---------|------|----------|
| Tarification | Multi-tarifs + TVA + templates | Prix unique TTC | Multi-tarifs SmartOF |
| Catalogue | Toggle + aperçu | Toggle + slug + image | Les deux |
| Documents | Auto-génération | Import PDF IA | Import PDF IA + auto-génération |
| Évaluations | Rattachées au produit | Basique | SmartOF |
| BPF | Spécialité + catégorie + niveau | Basique | SmartOF |
| Import IA PDF | Non | Oui | Oui (avantage concurrentiel) |
| Images IA | Non | Oui | Oui |
| Progression | Non | Oui (barre %) | Oui |

---

### 4.8 — ENQUÊTES DE SATISFACTION + QUESTIONNAIRES PÉDAGOGIQUES (fusionnés)

**Module unifié "Questionnaires"** — gère les deux types :

**Types de questionnaires :**
- Enquête de satisfaction (à chaud / à froid)
- Questionnaire pédagogique (positionnement pré / post formation)
- Standalone (prospection, analyse de besoins)

**Multi-public :** Apprenant, Contact client, Financeur, Formateur

**Types de questions :**
- QCU (choix unique)
- QCM (choix multiple)
- Note (échelle 0-10)
- Texte libre
- Vrai/Faux

**Fonctionnalités :**
- Statistiques avec graphiques (barres, moyennes)
- Alertes email personnalisables (si note < seuil)
- Relances automatiques (J+3, J+7 configurables)
- Import IA : PDF/Word → questions extraites automatiquement
- Scoring par question (points pour évaluation)
- Lien partageable unique par questionnaire ou par destinataire
- Dashboard réponses + KPIs + export (CSV, PDF)
- Duplicable
- Mode brouillon / actif / archivé

**Tables proposées :**
```
questionnaires (id, nom, type, public, introduction, relances_auto, formation_id, statut, is_default)
questionnaire_questions (id, questionnaire_id, ordre, texte, type, options jsonb, obligatoire, points)
questionnaire_invitations (id, questionnaire_id, email, nom, prenom, token, sent_at, opened_at, completed_at, relance_count, expires_at)
questionnaire_reponses (id, questionnaire_id, invitation_id, respondent_email, respondent_name, responses jsonb, score_total, submitted_at)
```

---

### 4.9 — SESSIONS DE FORMATION (SES)

**Préfixe** : SES-xxxx | **39 sessions** — MODULE LE PLUS COMPLEXE

**Statuts** : En projet (jaune) → Validée (vert) → Archivée

**Liste — colonnes clés :**
- ID, Statut, Nom, Commanditaire
- **Total budget** (ex: 2 430,96 €)
- **Coût de revient** (ex: 1 251,06 €)
- **Rentabilité** (Budget - Coût = 1 179,90 € en vert)
- Dates début/fin, Nombre d'apprenants (tooltip avec liste nominative)

**Détail session — Structure multi-onglets :**

**Onglet 1 — Général :**
- Nom session (auto depuis produit), Statut, Dates début/fin
- Nombre de places (min/max), Lieu (salle rattachée ou adresse libre)
- Formateur(s) assigné(s) (multi-select)
- Lien vers le produit de formation source
- Paramètres : automatisation émargement, données logistiques

**Onglet 2 — Commanditaires :**
- **Pattern multi-commanditaires** : une session peut avoir PLUSIEURS entreprises/financeurs
- Par commanditaire : entreprise, contact client, financeur (OPCO), convention
- **Workflow configurable** par commanditaire : pipeline d'étapes (analyse → convention → signature → facturation)
- Statut par étape (En attente, En cours, Validé, Signé)

**Onglet 3 — Apprenants :**
- Liste inscriptions par commanditaire
- Statut inscription : Inscrit, Confirmé, Annulé, Liste d'attente
- Ajout individuel ou import CSV
- Tooltip apprenants avec liste nominative au survol

**Onglet 4 — Créneaux / Planning :**
- Créneaux horaires détaillés (date, heure début, heure fin, durée calculée, formateur, lieu)
- **Émargement automatique** : toggle par créneau (ouverture/fermeture programmée)
- Vue calendrier intégrée
- Types de créneaux : Présentiel, Distanciel, E-learning, Stage

**Onglet 5 — Évaluations :**
- Enquêtes de satisfaction rattachées (à chaud / à froid)
- Questionnaires pédagogiques (pré / post)
- Importables depuis le produit de formation

**Onglet 6 — Documents :**
- Génération automatique : Convention, Convocation, Programme, Attestation, Certificat
- Templates par catégorie d'acteur (commanditaire, formateur, apprenant)
- Import documents manuels

**Onglet 7 — Financier :**
- **Revenus** par commanditaire (montant, statut paiement)
- **Charges** : coût formateur (auto = tarif jour × nb jours) + charges libres ajoutables
- **Rentabilité** : calcul automatique Revenus - Charges
- Liens vers devis et factures associés

**Onglet 8 — Extranet :**
- Statuts d'accès par rôle : Formateur, Apprenant, Contact client
- Statuts granulaires : Invité, En attente, Activé, Désactivé

---

### 4.10 — DEVIS (D)

**Préfixe** : D-ANNÉE-xxxx (ex: D-2026-0033)

**Workflow** : Brouillon → Envoyé → Signé / Refusé

**Layout** : Édition à gauche / Aperçu PDF temps réel à droite ← très bon UX à garder

**Champs :**
- Numéro (auto), Date émission, Date échéance
- **Destinataire** : Entreprise OU Particulier (toggle dual)
- Contact client associé
- Opportunité commerciale (rattachement optionnel)
- Objet du devis

**Lignes de devis :**
- Multi-lignes (plusieurs produits/prestations)
- Par ligne : Désignation, Description riche, Quantité, Prix unitaire HT, TVA
- TVA souvent exonérée (art. 261-4-4a du CGI pour les OF)
- Totaux : HT, TVA, TTC

**Actions :**
- **Transformer en session** ← conversion directe devis → session
- Envoyer par email (Resend + suivi ouverture)
- Dupliquer le devis
- Archiver / Supprimer

**Améliorations v2 :**
- Templates de devis sauvegardables
- Conversion devis → facture (en plus de devis → session)
- Signature électronique intégrée
- Relance automatique si pas signé après X jours

---

### 4.11 — FACTURES (F)

**Préfixe** : F-ANNÉE-xxxx (ex: F-2026-0015)

**Workflow** : Brouillon → Envoyée → Payée / En retard / Partiellement payée

**Même layout que devis** : Édition gauche / Aperçu PDF droite

**Champs :**
- Numéro (auto), Date émission, Date échéance
- Entreprise destinataire, Contact client
- Lien session (optionnel), Lien devis source (optionnel)
- Conditions de paiement
- Mentions légales obligatoires (NDA, SIRET, n° TVA intracommunautaire)

**Lignes facture :**
- Même structure que devis (désignation, description, qté, PU HT, TVA)
- Totaux calculés automatiquement

**Suivi paiements :**
- Enregistrement des paiements (date, montant, mode)
- Calcul automatique du solde restant
- Statut auto (Payée si solde = 0)

**Relances :**
- Relances automatiques à échéance + J+7 + J+14 + J+30
- Historique des relances

---

### 4.12 — AVOIRS (A)

**Préfixe** : A-ANNÉE-xxxx

- Lié à une facture d'origine
- Même structure que facture mais en négatif
- Génération depuis la facture (partiel ou total)

---

### 4.13 — EXPORT COMPTABLE

- Export FEC (Fichier des Écritures Comptables) pour le cabinet comptable
- Filtres par période, par compte
- Format CSV/FEC standard
- Numéros de compte comptable présents sur : Entreprises, Apprenants, Financeurs

---

### 4.14 — TICKETS

- Support interne / demandes
- Statuts : Ouvert, En cours, Résolu, Fermé
- Assignation à un utilisateur
- Historique des échanges

---

### 4.15 — PARAMÈTRES DE L'OF

**6 sections :**
- **Général** : Nom OF, SIRET, NDA (Numéro Déclaration d'Activité), Adresse, Logo
- **Documents** : Templates (convention, attestation, etc.), Mentions légales, Pied de page
- **Emails** : Templates Resend, Signatures, Paramètres relance
- **Facturation** : Numérotation auto, TVA par défaut, Conditions paiement, Coordonnées bancaires
- **Utilisateurs et activité** : Gestion comptes + rôles + logs d'activité
- **Avancé** : Config technique

---

## 4B. ACCÈS UTILISATEURS & RÔLES

### 4B.1 — Les 6 types d'utilisateurs

| Type | Zone | Comment il se connecte | Ce qu'il voit |
|------|------|----------------------|---------------|
| **Visiteur** | `candco.fr` (ou vitrine OF) | Pas de login | Catalogue formations, blog, inscription sessions publiques |
| **Admin OF** | `app.candco.fr/dashboard` | Email + MDP (créé à l'inscription) | Back-office complet de son OF |
| **Manager OF** | `app.candco.fr/dashboard` | Email + MDP (invité par admin) | Back-office sans paramètres ni suppression |
| **Formateur** | `app.candco.fr/extranet/formateur` | Invité par admin → reçoit email → crée son MDP | Ses sessions, planning, dispos, facturation, messagerie |
| **Apprenant** | `app.candco.fr/extranet/apprenant` | Invité par admin ou inscrit via vitrine → reçoit email → crée son MDP | Ses sessions, émargement, documents, certificats, messagerie |
| **Contact client** | `app.candco.fr/extranet/client` | Invité par admin → reçoit email → crée son MDP | Sessions de son entreprise, devis, factures, documents |
| **Super-admin** | `app.candco.fr/admin` | Compte spécial C&CO | Toutes les organisations, tickets globaux, stats plateforme |

### 4B.2 — Login unique + Routing par rôle

Un seul formulaire de login sur `app.candco.fr/login`. Le middleware route automatiquement après connexion :

```
auth.users identifié
  │
  ├── Trouvé dans utilisateurs ?
  │   ├── is_super_admin = true → /admin (vue plateforme)
  │   └── sinon → /dashboard (back-office de son OF)
  │
  └── Trouvé dans extranet_acces ?
      ├── role = 'formateur'       → /extranet/formateur
      ├── role = 'apprenant'       → /extranet/apprenant
      └── role = 'contact_client'  → /extranet/client
```

### 4B.3 — Flux d'invitation extranet

L'admin d'un OF invite un formateur, apprenant ou contact client depuis le back-office :

```
Admin → fiche formateur/apprenant/contact → "Inviter à l'extranet"
  │
  1. Crée un compte auth.users avec l'email de la personne
  2. Crée une entrée extranet_acces (role, entite_type, entite_id, statut='invite')
  3. Envoie un email d'invitation (Resend) avec un lien de premier accès
  │
  ▼
La personne clique le lien → définit son mot de passe → statut passe à 'actif'
```

### 4B.4 — Super-admin & Multi-organisation

Le super-admin C&CO peut naviguer entre toutes les organisations.

**Dans la sidebar, en haut à gauche — sélecteur d'organisation :**

```
[▼ C&CO Formation    ]
  ├── C&CO Formation     ← son OF
  ├── Formation ABC      ← un client
  ├── Formation XYZ      ← un autre client
  └── ⚙ Admin plateforme ← vue globale
```

- **Sélectionner un OF** → le super-admin voit le back-office de cet OF comme s'il était leur admin
- **Sélectionner "Admin plateforme"** → vue globale avec :
  - Liste de tous les OF inscrits
  - Statistiques globales (nombre d'OF, d'apprenants, de sessions)
  - **Tous les tickets de tous les OF** (support centralisé)
  - Gestion des abonnements (quel OF a quel plan)
  - Logs d'activité

**Table `user_organisations`** : un admin peut être rattaché à plusieurs organisations (many-to-many).

### 4B.5 — RBAC back-office (permissions par rôle)

| Fonctionnalité | Admin | Manager | User |
|----------------|-------|---------|------|
| CRM complet (lecture) | Oui | Oui | Oui |
| CRM (création/modification) | Oui | Oui | Non |
| Créer/modifier sessions | Oui | Oui | Non |
| Devis / Factures | Oui | Oui | Lecture seule |
| Paramètres OF | Oui | Non | Non |
| Gérer utilisateurs | Oui | Non | Non |
| Inviter à l'extranet | Oui | Oui | Non |
| Export comptable / BPF | Oui | Non | Non |
| Supprimer des données | Oui | Non | Non |
| Switcher d'organisation | Si multi-org | Si multi-org | Non |

### 4B.6 — Espace Formateur (app.candco.fr/extranet/formateur)

| Page | Contenu |
|------|---------|
| **Tableau de bord** | Prochaines sessions, alertes, stats personnelles |
| **Mes sessions** | Sessions assignées avec détail (apprenants, créneaux, lieu) |
| **Planning** | Calendrier de toutes ses interventions |
| **Disponibilités** | Déclarer ses dispos (calendrier éditable, export iCal) |
| **Documents** | Contrats sous-traitance, conventions, ressources pédagogiques à déposer |
| **Facturation** | Créer des factures vers l'OF (montant pré-calculé : tarif jour × nb jours) |
| **Questionnaires** | Évaluations formateur à remplir |
| **Messagerie** | Chat temps réel avec admin et apprenants de ses sessions |
| **Mon profil** | Coordonnées, compétences, SIRET, NDA |

### 4B.7 — Espace Apprenant (app.candco.fr/extranet/apprenant)

| Page | Contenu |
|------|---------|
| **Tableau de bord** | Sessions en cours, prochains créneaux |
| **Mes sessions** | Sessions où il est inscrit, statut d'inscription |
| **Planning** | Vue calendrier de ses créneaux |
| **Émargement** | Signer sa présence quand le créneau est ouvert |
| **Documents** | Conventions, attestations, certificats à télécharger |
| **Questionnaires** | Satisfaction et évaluations pédagogiques à remplir |
| **Messagerie** | Chat avec formateurs et admin |
| **Mon profil** | Modifier ses infos personnelles |

### 4B.8 — Espace Contact Client (app.candco.fr/extranet/client)

| Page | Contenu |
|------|---------|
| **Tableau de bord** | Sessions en cours pour son entreprise, devis en attente |
| **Sessions** | Suivi des sessions commanditées (statut, apprenants, progression) |
| **Devis** | Consulter, signer (signature électronique) |
| **Factures** | Consulter, télécharger PDF, statut paiement |
| **Documents** | Conventions à signer, attestations de fin de formation |
| **Questionnaires** | Satisfaction commanditaire |
| **Messagerie** | Échanges avec l'admin de l'OF |

### 4B.9 — Site vitrine par OF

Chaque OF peut activer un site vitrine public connecté à sa BDD.

**Activation :** Admin OF → Paramètres → Site vitrine → Activer

**Configuration :**
- Sous-domaine gratuit : `formation-abc.candco.app`
- OU domaine custom : `formationabc.fr` (CNAME vers notre serveur)
- Logo, couleurs, description
- Pages à activer : catalogue, blog, inscriptions, contact

**Pages vitrine :**
- Accueil (présentation OF)
- Catalogue (formations publiées avec `publie=true`)
- Fiche formation (`/formations/[slug]`) + sessions ouvertes
- Inscription publique (`/inscription/[sessionId]`) — formulaire sans compte requis
- Blog / Articles
- Contact

**Parcours d'inscription publique :**

```
Visiteur → catalogue → fiche formation → "S'inscrire" à une session
  │
  ▼
Formulaire (pas de compte requis) :
  Civilité, Prénom, Nom, Email, Téléphone, Entreprise (optionnel), CGV
  │
  ▼
Server Action :
  1. Cherche si l'email existe dans apprenants → sinon crée la fiche
  2. Crée l'inscription (liste_attente ou inscrit selon places)
  3. Email de confirmation à l'apprenant (Resend)
  4. Notification à l'admin de l'OF
  │
  ▼
L'admin valide dans le back-office → peut inviter à l'extranet
```

**Le projet vitrine est un projet Next.js séparé** (voir Phase 13), multi-tenant par domaine :
le middleware détecte le `Host` → cherche l'organisation → affiche ses données.

### 4B.10 — Messagerie temps réel

Chat intégré dans les espaces extranet et le back-office via Supabase Realtime.

**Types de conversations :**
- **Direct** : entre 2 personnes (admin ↔ formateur, formateur ↔ apprenant, etc.)
- **Groupe session** : tous les participants d'une session (formateur + apprenants + admin)
- **Support** : apprenant/formateur → admin (questions, demandes)

**Fonctionnalités :**
- Messages texte + pièces jointes (fichiers via Supabase Storage)
- Indicateur de messages non lus
- Notifications en temps réel (Supabase Realtime écoute les INSERT sur `messages`)

---

## 5. SCHÉMA BDD v2

### Conventions

- **Nommage** : snake_case, pluriel pour les tables
- **IDs** : UUID (gen_random_uuid())
- **Timestamps** : created_at, updated_at sur toutes les tables
- **Soft delete** : archived_at (nullable) au lieu de suppression
- **Multi-tenant** : organisation_id sur toutes les tables métier
- **Préfixes d'affichage** : Générés côté app (APP-0001, ENT-0002, etc.), stockés en séquence dans une table `sequences`

### Tables principales

```sql
-- ═══════════════════════════════════════════
-- ORGANISATION / MULTI-TENANT
-- ═══════════════════════════════════════════

organisations (
  id uuid PK,
  nom text NOT NULL,
  siret text,
  nda text,                          -- Numéro Déclaration d'Activité
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  logo_url text,
  settings jsonb DEFAULT '{}',       -- Config générale (TVA défaut, mentions légales, etc.)
  -- Vitrine (site public de l'OF)
  vitrine_active boolean DEFAULT false,
  sous_domaine text UNIQUE,          -- formation-abc → formation-abc.candco.app
  domaine_custom text UNIQUE,        -- formationabc.fr (CNAME vers notre serveur)
  vitrine_config jsonb DEFAULT '{}', -- Couleurs, pages actives, SEO, etc.
  created_at, updated_at
)

utilisateurs (
  id uuid PK,                        -- = auth.users.id
  organisation_id uuid FK → organisations,
  email text NOT NULL,
  prenom text,
  nom text,
  role text DEFAULT 'user',          -- admin, manager, user
  is_super_admin boolean DEFAULT false,  -- Accès à toutes les orgs + admin plateforme
  avatar_url text,
  actif boolean DEFAULT true,
  created_at, updated_at
)

user_organisations (                 -- Multi-org : un admin peut gérer plusieurs OF
  id uuid PK,
  user_id uuid FK → auth.users,
  organisation_id uuid FK → organisations,
  role text DEFAULT 'admin',         -- admin, manager, user
  is_default boolean DEFAULT false,  -- Organisation affichée par défaut
  created_at
)

-- ═══════════════════════════════════════════
-- TABLES DE RÉFÉRENCE
-- ═══════════════════════════════════════════

bpf_categories_entreprise (          -- Codes BPF pour entreprises (C.1, C.2.a, etc.)
  id uuid PK,
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre int
)

bpf_categories_apprenant (           -- Codes BPF pour apprenants (F.1.a, F.2, etc.)
  id uuid PK,
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  ordre int
)

bpf_specialites (                    -- Spécialités pour produits de formation
  id uuid PK,
  code text,
  libelle text NOT NULL,
  ordre int
)

sequences (                          -- Compteurs auto pour préfixes ID
  id uuid PK,
  organisation_id uuid FK,
  entite text NOT NULL,              -- 'APP', 'ENT', 'SES', 'D', 'F', 'A', etc.
  compteur int DEFAULT 0,
  UNIQUE (organisation_id, entite)
)

-- ═══════════════════════════════════════════
-- CRM — BASE DE CONTACTS
-- ═══════════════════════════════════════════

entreprises (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- ENT-0056 (généré)
  nom text NOT NULL,
  siret text,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  -- Facturation (adresse séparée)
  facturation_raison_sociale text,
  facturation_rue text,
  facturation_complement text,
  facturation_cp text,
  facturation_ville text,
  -- BPF & Comptabilité
  bpf_categorie_id uuid FK → bpf_categories_entreprise,
  numero_compte_comptable text DEFAULT '411000',
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

apprenants (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- APP-0324
  civilite text,                     -- Monsieur / Madame
  prenom text NOT NULL,
  nom text NOT NULL,
  nom_naissance text,
  email text,
  telephone text,
  date_naissance date,
  fonction text,
  lieu_activite text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  bpf_categorie_id uuid FK → bpf_categories_apprenant,
  numero_compte_comptable text,
  -- Extranet
  extranet_actif boolean DEFAULT false,
  extranet_user_id uuid,             -- Lien auth.users si extranet activé
  -- Intégrations
  pennylane_id text,
  lms_id text,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

apprenant_entreprises (              -- Many-to-many
  id uuid PK,
  apprenant_id uuid FK → apprenants,
  entreprise_id uuid FK → entreprises,
  UNIQUE (apprenant_id, entreprise_id)
)

contacts_clients (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- CTC-0065
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  fonction text,
  -- Extranet
  extranet_actif boolean DEFAULT false,
  extranet_user_id uuid,             -- Lien auth.users si extranet activé
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

contact_entreprises (                -- Many-to-many
  id uuid PK,
  contact_client_id uuid FK → contacts_clients,
  entreprise_id uuid FK → entreprises,
  UNIQUE (contact_client_id, entreprise_id)
)

formateurs (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- FOR-0016
  civilite text,
  prenom text NOT NULL,
  nom text NOT NULL,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  -- Professionnel
  statut_bpf text NOT NULL DEFAULT 'externe',  -- 'interne' / 'externe'
  nda text,                          -- Numéro Déclaration d'Activité (si sous-traitant)
  siret text,
  -- Coûts
  tarif_journalier numeric(10,2),    -- HT
  taux_tva numeric(5,2) DEFAULT 0,
  heures_par_jour numeric(4,2) DEFAULT 7,  -- Pour calcul tarif horaire auto
  -- Extranet
  extranet_actif boolean DEFAULT false,
  extranet_user_id uuid,
  lien_calendrier_ical text,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

formateur_competences (
  id uuid PK,
  formateur_id uuid FK → formateurs,
  competence text NOT NULL
)

financeurs (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- FIN-0012
  nom text NOT NULL,
  type text,                         -- OPCO, Pôle Emploi, Région, AGEFIPH, Entreprise, Autre
  siret text,
  email text,
  telephone text,
  adresse_rue text,
  adresse_complement text,
  adresse_cp text,
  adresse_ville text,
  numero_compte_comptable text,
  bpf_categorie_id uuid FK → bpf_categories_entreprise,
  archived_at timestamptz,
  created_at, updated_at
)

-- ═══════════════════════════════════════════
-- BIBLIOTHÈQUE — PRODUITS DE FORMATION
-- ═══════════════════════════════════════════

produits_formation (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- PROD-0025
  intitule text NOT NULL,
  sous_titre text,
  description text,                  -- Éditeur riche (HTML)
  identifiant_interne text,
  -- Classification
  domaine text,                      -- Pôle / domaine
  type_action text,                  -- Action de formation, Bilan compétences, VAE, Apprentissage
  modalite text,                     -- Présentiel, Distanciel, Mixte, AFEST
  formule text,                      -- Inter, Intra, Individuel
  -- Durée
  duree_heures numeric(8,2),
  duree_jours numeric(8,2),
  -- BPF
  bpf_specialite_id uuid FK → bpf_specialites,
  bpf_categorie text,               -- A, B, C
  bpf_niveau text,                   -- I à V
  -- Catalogue en ligne
  publie boolean DEFAULT false,
  populaire boolean DEFAULT false,
  slug text,
  image_url text,
  -- Complétion
  completion_pct int DEFAULT 0,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

produit_tarifs (
  id uuid PK,
  produit_id uuid FK → produits_formation,
  nom text,                          -- Ex: "Tarif standard", "Tarif OPCO"
  prix_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  unite text,                        -- 'stagiaire', 'groupe', 'jour', 'heure', 'forfait'
  is_default boolean DEFAULT false,
  created_at, updated_at
)

produit_objectifs (
  id uuid PK,
  produit_id uuid FK → produits_formation,
  objectif text NOT NULL,
  ordre int
)

produit_programme (
  id uuid PK,
  produit_id uuid FK → produits_formation,
  titre text NOT NULL,
  contenu text,                      -- HTML
  duree text,
  ordre int
)

produit_documents (
  id uuid PK,
  produit_id uuid FK → produits_formation,
  nom text NOT NULL,
  categorie text,                    -- programme, plaquette, convention, attestation
  fichier_url text,
  genere boolean DEFAULT false,      -- Auto-généré ou importé
  created_at
)

-- ═══════════════════════════════════════════
-- QUESTIONNAIRES (SATISFACTION + PÉDAGOGIQUE)
-- ═══════════════════════════════════════════

questionnaires (
  id uuid PK,
  organisation_id uuid FK,
  nom text NOT NULL,
  type text NOT NULL,                -- 'satisfaction_chaud', 'satisfaction_froid', 'pedagogique_pre', 'pedagogique_post', 'standalone'
  public_cible text,                 -- 'apprenant', 'contact_client', 'financeur', 'formateur'
  introduction text,
  produit_id uuid FK → produits_formation,  -- Nullable (standalone = pas lié)
  relances_auto boolean DEFAULT true,
  relance_j3 boolean DEFAULT true,
  relance_j7 boolean DEFAULT true,
  statut text DEFAULT 'brouillon',   -- brouillon, actif, archivé
  is_default boolean DEFAULT false,
  created_at, updated_at
)

questionnaire_questions (
  id uuid PK,
  questionnaire_id uuid FK,
  ordre int NOT NULL,
  texte text NOT NULL,
  type text NOT NULL,                -- 'libre', 'echelle', 'choix_unique', 'choix_multiple', 'vrai_faux'
  options jsonb,                     -- Pour les choix [{label, value}]
  obligatoire boolean DEFAULT true,
  points int DEFAULT 0,              -- Pour scoring
  created_at
)

questionnaire_invitations (
  id uuid PK,
  questionnaire_id uuid FK,
  session_id uuid FK,               -- Nullable
  email text NOT NULL,
  nom text,
  prenom text,
  token text UNIQUE NOT NULL,        -- Lien unique
  sent_at timestamptz,
  opened_at timestamptz,
  completed_at timestamptz,
  relance_count int DEFAULT 0,
  expires_at timestamptz,
  created_at
)

questionnaire_reponses (
  id uuid PK,
  questionnaire_id uuid FK,
  invitation_id uuid FK,            -- Nullable si anonyme
  respondent_email text,
  respondent_name text,
  responses jsonb NOT NULL,          -- [{question_id, answer, score}]
  score_total int,
  submitted_at timestamptz NOT NULL,
  created_at
)

questionnaire_alertes (
  id uuid PK,
  questionnaire_id uuid FK,
  question_id uuid FK,
  condition text,                    -- 'inferieur_a', 'egal_a'
  seuil numeric,
  email_destinataire text,
  actif boolean DEFAULT true,
  created_at
)

-- ═══════════════════════════════════════════
-- SESSIONS DE FORMATION
-- ═══════════════════════════════════════════

sessions (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- SES-0058
  produit_id uuid FK → produits_formation,
  nom text NOT NULL,
  statut text DEFAULT 'en_projet',   -- en_projet, validee, en_cours, terminee, archivee
  date_debut date,
  date_fin date,
  places_min int,
  places_max int,
  lieu_salle_id uuid FK → salles,   -- Nullable
  lieu_adresse text,                 -- Adresse libre si pas de salle
  lieu_type text,                    -- presentiel, distanciel, mixte
  -- Émargement
  emargement_auto boolean DEFAULT false,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

session_formateurs (
  id uuid PK,
  session_id uuid FK → sessions,
  formateur_id uuid FK → formateurs,
  role text DEFAULT 'principal',     -- principal, intervenant
  UNIQUE (session_id, formateur_id)
)

-- Commanditaires (multi-commanditaires par session)
session_commanditaires (
  id uuid PK,
  session_id uuid FK → sessions,
  entreprise_id uuid FK → entreprises,
  contact_client_id uuid FK → contacts_clients,
  financeur_id uuid FK → financeurs,  -- Nullable (pas toujours un financeur)
  convention_signee boolean DEFAULT false,
  convention_url text,
  budget numeric(10,2) DEFAULT 0,
  statut_workflow text DEFAULT 'analyse', -- analyse, convention, signature, facturation, termine
  notes text,
  created_at, updated_at
)

-- Inscriptions (apprenants inscrits via un commanditaire)
inscriptions (
  id uuid PK,
  session_id uuid FK → sessions,
  apprenant_id uuid FK → apprenants,
  commanditaire_id uuid FK → session_commanditaires,
  statut text DEFAULT 'inscrit',     -- inscrit, confirme, annule, liste_attente
  notes text,
  created_at, updated_at,
  UNIQUE (session_id, apprenant_id)
)

-- Créneaux horaires
session_creneaux (
  id uuid PK,
  session_id uuid FK → sessions,
  date date NOT NULL,
  heure_debut time NOT NULL,
  heure_fin time NOT NULL,
  duree_minutes int,                 -- Calculé auto
  formateur_id uuid FK → formateurs,
  salle_id uuid FK → salles,
  type text DEFAULT 'presentiel',    -- presentiel, distanciel, elearning, stage
  emargement_ouvert boolean DEFAULT false,
  created_at, updated_at
)

-- Émargement
emargements (
  id uuid PK,
  creneau_id uuid FK → session_creneaux,
  apprenant_id uuid FK → apprenants,
  present boolean,
  signature_url text,                -- Image signature
  heure_signature timestamptz,
  ip_address text,
  created_at
)

-- Évaluations rattachées à la session
session_evaluations (
  id uuid PK,
  session_id uuid FK → sessions,
  questionnaire_id uuid FK → questionnaires,
  type text,                         -- satisfaction_chaud, satisfaction_froid, pedagogique_pre, pedagogique_post
  date_envoi timestamptz,
  created_at
)

-- ═══════════════════════════════════════════
-- FINANCIER — DEVIS / FACTURES / AVOIRS
-- ═══════════════════════════════════════════

devis (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- D-2026-0033
  -- Destinataire
  entreprise_id uuid FK → entreprises,  -- Nullable (soit entreprise soit particulier)
  contact_client_id uuid FK → contacts_clients,
  particulier_nom text,              -- Si particulier
  particulier_email text,
  particulier_adresse text,
  -- Dates
  date_emission date NOT NULL,
  date_echeance date,
  -- Contenu
  objet text,
  conditions text,
  mentions_legales text,
  -- Montants (calculés depuis les lignes)
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  -- Workflow
  statut text DEFAULT 'brouillon',   -- brouillon, envoye, signe, refuse, expire
  envoye_le timestamptz,
  signe_le timestamptz,
  -- Relations
  session_id uuid FK → sessions,     -- Si converti en session
  opportunite_id uuid FK → opportunites,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

devis_lignes (
  id uuid PK,
  devis_id uuid FK → devis,
  designation text NOT NULL,
  description text,                  -- Description riche
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),          -- Calculé
  ordre int,
  created_at
)

factures (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- F-2026-0015
  -- Destinataire
  entreprise_id uuid FK → entreprises,
  contact_client_id uuid FK → contacts_clients,
  -- Dates
  date_emission date NOT NULL,
  date_echeance date,
  -- Contenu
  objet text,
  conditions_paiement text,
  mentions_legales text,
  -- Montants
  total_ht numeric(10,2) DEFAULT 0,
  total_tva numeric(10,2) DEFAULT 0,
  total_ttc numeric(10,2) DEFAULT 0,
  montant_paye numeric(10,2) DEFAULT 0,
  -- Workflow
  statut text DEFAULT 'brouillon',   -- brouillon, envoyee, payee, partiellement_payee, en_retard
  envoye_le timestamptz,
  -- Relations
  devis_id uuid FK → devis,          -- Si générée depuis un devis
  session_id uuid FK → sessions,
  -- Méta
  archived_at timestamptz,
  created_at, updated_at
)

facture_lignes (
  id uuid PK,
  facture_id uuid FK → factures,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2) DEFAULT 1,
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),
  ordre int,
  created_at
)

facture_paiements (
  id uuid PK,
  facture_id uuid FK → factures,
  date_paiement date NOT NULL,
  montant numeric(10,2) NOT NULL,
  mode text,                         -- virement, chèque, CB, espèces
  reference text,
  notes text,
  created_at
)

avoirs (
  id uuid PK,
  organisation_id uuid FK,
  numero_affichage text,             -- A-2026-0001
  facture_id uuid FK → factures,     -- Facture d'origine
  date_emission date NOT NULL,
  motif text,
  total_ht numeric(10,2),
  total_tva numeric(10,2),
  total_ttc numeric(10,2),
  statut text DEFAULT 'brouillon',
  archived_at timestamptz,
  created_at, updated_at
)

avoir_lignes (
  id uuid PK,
  avoir_id uuid FK → avoirs,
  designation text NOT NULL,
  description text,
  quantite numeric(10,2),
  prix_unitaire_ht numeric(10,2),
  taux_tva numeric(5,2) DEFAULT 0,
  montant_ht numeric(10,2),
  ordre int,
  created_at
)

-- ═══════════════════════════════════════════
-- SUIVI COMMERCIAL
-- ═══════════════════════════════════════════

opportunites (
  id uuid PK,
  organisation_id uuid FK,
  nom text NOT NULL,
  entreprise_id uuid FK → entreprises,
  contact_client_id uuid FK → contacts_clients,
  montant_estime numeric(10,2),
  statut text DEFAULT 'prospect',    -- prospect, qualification, proposition, negociation, gagne, perdu
  date_cloture_prevue date,
  notes text,
  archived_at timestamptz,
  created_at, updated_at
)

-- ═══════════════════════════════════════════
-- TÂCHES & ACTIVITÉS (CRM intégré)
-- ═══════════════════════════════════════════

taches (
  id uuid PK,
  organisation_id uuid FK,
  titre text NOT NULL,
  description text,
  statut text DEFAULT 'a_faire',     -- a_faire, en_cours, terminee
  priorite text DEFAULT 'normale',   -- basse, normale, haute, urgente
  date_echeance date,
  assignee_id uuid FK → utilisateurs,
  -- Polymorphique : rattachement à n'importe quelle entité
  entite_type text,                  -- 'entreprise', 'apprenant', 'contact_client', 'formateur', 'session', etc.
  entite_id uuid,
  completed_at timestamptz,
  created_at, updated_at
)

activites (                          -- Journal d'activité / notes CRM
  id uuid PK,
  organisation_id uuid FK,
  auteur_id uuid FK → utilisateurs,
  contenu text NOT NULL,
  -- Polymorphique
  entite_type text,
  entite_id uuid,
  created_at
)

-- ═══════════════════════════════════════════
-- DOCUMENTS & GÉNÉRATION
-- ═══════════════════════════════════════════

documents (
  id uuid PK,
  organisation_id uuid FK,
  nom text NOT NULL,
  categorie text,                    -- convention, contrat_sous_traitance, attestation, certificat, programme, autre
  fichier_url text NOT NULL,
  taille_octets int,
  mime_type text,
  genere boolean DEFAULT false,
  -- Polymorphique
  entite_type text,                  -- 'session', 'formateur', 'apprenant', 'produit', etc.
  entite_id uuid,
  created_at
)

document_templates (
  id uuid PK,
  organisation_id uuid FK,
  nom text NOT NULL,
  categorie text NOT NULL,
  contenu_html text,                 -- Template avec variables {{nom}}, {{date}}, etc.
  actif boolean DEFAULT true,
  created_at, updated_at
)

-- ═══════════════════════════════════════════
-- EMAILS
-- ═══════════════════════════════════════════

emails_envoyes (
  id uuid PK,
  organisation_id uuid FK,
  destinataire_email text NOT NULL,
  destinataire_nom text,
  sujet text NOT NULL,
  contenu_html text,
  statut text DEFAULT 'envoye',      -- envoye, delivre, ouvert, erreur
  resend_id text,                    -- ID Resend pour tracking
  -- Contexte
  entite_type text,
  entite_id uuid,
  template text,
  created_at
)

-- ═══════════════════════════════════════════
-- DIVERS
-- ═══════════════════════════════════════════

salles (
  id uuid PK,
  organisation_id uuid FK,
  nom text NOT NULL,
  adresse text,
  capacite int,
  equipements text,                  -- Vidéoprojecteur, Tableau blanc, etc.
  actif boolean DEFAULT true,
  created_at, updated_at
)

tickets (
  id uuid PK,
  organisation_id uuid FK,
  titre text NOT NULL,
  description text,
  statut text DEFAULT 'ouvert',      -- ouvert, en_cours, resolu, ferme
  priorite text DEFAULT 'normale',
  auteur_id uuid FK → utilisateurs,
  assignee_id uuid FK → utilisateurs,
  created_at, updated_at
)

ticket_messages (
  id uuid PK,
  ticket_id uuid FK → tickets,
  auteur_id uuid FK → utilisateurs,
  contenu text NOT NULL,
  created_at
)

-- ═══════════════════════════════════════════
-- EXTRANET (accès externes)
-- ═══════════════════════════════════════════

extranet_acces (
  id uuid PK,
  organisation_id uuid FK,
  user_id uuid FK,                   -- auth.users
  role text NOT NULL,                -- 'formateur', 'apprenant', 'contact_client'
  entite_type text NOT NULL,
  entite_id uuid NOT NULL,
  statut text DEFAULT 'invite',      -- invite, en_attente, actif, desactive
  invite_le timestamptz,
  active_le timestamptz,
  created_at, updated_at
)

-- ═══════════════════════════════════════════
-- MESSAGERIE TEMPS RÉEL
-- ═══════════════════════════════════════════

conversations (
  id uuid PK,
  organisation_id uuid FK,
  type text NOT NULL,                -- 'direct', 'session_group', 'support'
  session_id uuid FK → sessions,     -- Si conversation de groupe liée à une session
  titre text,                        -- Optionnel, pour les groupes
  created_at
)

conversation_participants (
  id uuid PK,
  conversation_id uuid FK → conversations,
  user_id uuid FK → auth.users,
  role text,                         -- 'admin', 'formateur', 'apprenant', 'contact_client'
  dernier_lu_at timestamptz,         -- Pour calculer les messages non lus
  created_at
)

messages (
  id uuid PK,
  organisation_id uuid FK,
  conversation_id uuid FK → conversations,
  sender_id uuid FK → auth.users,
  contenu text NOT NULL,
  fichier_url text,                  -- Pièce jointe (Supabase Storage)
  fichier_nom text,
  lu boolean DEFAULT false,
  created_at
)

-- ═══════════════════════════════════════════
-- BLOG / ARTICLES (vitrines OF)
-- ═══════════════════════════════════════════

articles (
  id uuid PK,
  organisation_id uuid FK,
  titre text NOT NULL,
  slug text NOT NULL,
  contenu text,                      -- HTML éditeur riche
  extrait text,                      -- Résumé court pour les listes
  image_url text,
  publie boolean DEFAULT false,
  date_publication timestamptz,
  categorie text,
  tags text[],
  auteur_id uuid FK → utilisateurs,
  created_at, updated_at
)
```

-- ═══════════════════════════════════════════
-- TABLES SUPPLÉMENTAIRES (ajoutées post-design initial)
-- ═══════════════════════════════════════════

-- Entreprise : structure organisationnelle
entreprise_agences (id, entreprise_id, nom, adresse, ...)
entreprise_poles (id, entreprise_id, nom, ...)
entreprise_membres (id, entreprise_id, nom, fonction, ...)
membre_agences (id, membre_id, agence_id)
apprenant_entreprise_agences (id, apprenant_entreprise_id, agence_id)

-- Produits : champs étendus
produit_competences (id, produit_id, competence, ordre)
produit_prerequis (id, produit_id, prerequis, ordre)
produit_public_vise (id, produit_id, public, ordre)
produit_financement (id, produit_id, financeur, description)
produit_ouvrages (id, produit_id, titre, auteur, editeur, annee, isbn)
produit_articles (id, produit_id, titre, auteur, revue, annee, doi)
produit_references_biblio (id, produit_id, type, titre, auteur, ...)
produit_questionnaires (id, produit_id, questionnaire_id)
produit_questionnaire_planifications (id, produit_id, questionnaire_id, type, timing, ...)
session_questionnaire_planifications (id, session_id, questionnaire_id, type, timing, ...)

-- Catalogue
catalogue_categories (id, organisation_id, nom, parent_id, ordre)

-- Formation
besoins_formation (id, organisation_id, titre, description, statut, ...)
plans_formation (id, organisation_id, nom, periode, statut, ...)
plan_budgets_agence (id, plan_id, agence_id, budget, ...)

-- Import
import_templates (id, organisation_id, nom, entite_type, mapping jsonb)

-- Formateur
formateur_disponibilites (id, formateur_id, date_debut, date_fin, statut)

-- Tickets étendus
ticket_mentions (id, ticket_message_id, user_id)
ticket_historique (id, ticket_id, action, details jsonb, user_id)

-- Historique
historique_events (id, organisation_id, module, action, description, ...)

-- Fonctions prédéfinies
fonctions_predefinies (id, organisation_id, libelle, entite_type)
```

### Total : ~75 tables

---

## 6. DESIGN SYSTEM

### Style Cursor (Noir / Gris / Orange)

**Palette :**
- Background principal : `#0A0A0A` (noir profond)
- Background secondaire : `#141414` (gris très foncé)
- Background cartes/panels : `#1A1A1A`
- Bordures : `#2A2A2A`
- Texte principal : `#FAFAFA` (blanc cassé)
- Texte secondaire : `#A0A0A0` (gris moyen)
- Accent principal : `#F97316` (orange — Tailwind orange-500)
- Accent hover : `#EA580C` (orange-600)
- Succès : `#22C55E` (vert)
- Erreur : `#EF4444` (rouge)
- Warning : `#EAB308` (jaune)
- Info : `#3B82F6` (bleu)

**Typographie :**
- Font : Inter (ou Geist si dispo)
- Tailles : 12px (small), 14px (body), 16px (subtitle), 20px (title), 28px (heading)

**Composants clés :**
- Sidebar fixe à gauche (collapsible)
- Header avec breadcrumb + actions
- Tables avec colonnes triables, drag & drop colonnes
- Modales pour création/édition
- Panneaux latéraux droits (détails rapides)
- Toast notifications
- Badges colorés pour statuts

**Librairies UI recommandées :**
- Tailwind CSS v4
- shadcn/ui (composants)
- Lucide React (icônes)
- Tanstack Table (tables avancées)
- DnD Kit (drag & drop)

---

## 7. ROADMAP PAR PHASES

### Phase 0 — Fondations ✅ TERMINÉE
> **Objectif** : App fonctionnelle mais vide, prête à recevoir les modules

- [x] Initialisation Next.js 16 + TypeScript strict
- [x] Configuration Tailwind v4 + shadcn/ui + design system Cursor
- [x] Setup Supabase self-hosted (connexion depuis Next.js)
- [x] Auth : login/register + middleware + protection routes
- [x] Layout principal : Sidebar + Header + Breadcrumb
- [x] Migration BDD : tables organisations, utilisateurs, sequences, bpf_categories
- [x] RLS (Row Level Security) multi-tenant sur toutes les tables
- [x] Deploy sur Coolify (CI/CD GitHub → Coolify)
- [x] Composants de base : DataTable générique, Modal, Panel latéral, Toast, Badges

### Phase 1 — CRM / Base de contacts ✅ TERMINÉE
> **Objectif** : Pouvoir gérer toutes les entités de base

- [x] Module **Entreprises** (CRUD complet, 6 onglets, recherche INSEE)
- [x] Module **Apprenants** (CRUD, relation many-to-many entreprises, BPF, import CSV)
- [x] Module **Contacts clients** (CRUD, association multi-entreprises)
- [x] Module **Formateurs** (CRUD, compétences, coûts, BPF interne/externe)
- [x] Module **Financeurs** (CRUD, types OPCO/PE/Région)
- [x] Module **Salles** (CRUD, capacité, équipements)
- [x] Système de **tâches & activités** (polymorphique, rattachable à toute entité)
- [x] **Colonnes personnalisables** (toggles de colonnes sauvegardés en localStorage)
- [x] **Recherche avancée** + **Export CSV** (UTF-8 BOM, tous les modules)
- [x] **Archivage** (soft delete avec archived_at)
- [x] **Import CSV/Excel** (SheetJS, mapping colonnes intelligent)
- [ ] Système de **vues sauvegardées** en onglets (filtres + tri sauvegardés en BDD)

### Phase 2 — Catalogue & Bibliothèque ✅ TERMINÉE
> **Objectif** : Pouvoir créer et gérer le catalogue de formations

- [x] Module **Produits de formation** (CRUD, onglets, tarifs, objectifs, programme)
- [x] Tarification multi-tarifs + TVA
- [x] Programme (édition riche, ordre des modules)
- [x] Objectifs pédagogiques
- [x] Import PDF IA → remplissage auto (feature killer)
- [x] Images IA (feature killer)
- [x] Barre de progression complétion (feature killer)
- [x] Toggle publication catalogue en ligne
- [x] BPF produit (spécialité, catégorie, niveau)

### Phase 3 — Sessions de formation ✅ TERMINÉE
> **Objectif** : Le coeur du métier — gestion complète des sessions

- [x] Module **Sessions** (CRUD, statuts, lien produit)
- [x] **Multi-commanditaires** par session (entreprises + financeurs)
- [x] **Inscriptions** (par commanditaire, statuts)
- [x] **Créneaux horaires** (planning détaillé, types)
- [x] **Émargement** (ouverture/fermeture par créneau + suivi présence admin)
- [x] **Planning** (vue calendrier — semaine/mois)
- [x] Workflow commanditaires (pipeline d'étapes configurable)
- [x] Évaluations rattachées (satisfaction + pédagogique)
- [x] Documents session (import + suppression + catégorisation)
- [x] Calcul **rentabilité** auto (budget - coût formateur - charges)

### Phase 4 — Questionnaires ✅ TERMINÉE
> **Objectif** : Enquêtes de satisfaction + évaluations pédagogiques

- [x] Module **Questionnaires** unifié (satisfaction + péda + standalone)
- [x] Création questions (5 types + scoring)
- [x] Envoi par email (Resend, lien unique par destinataire)
- [x] Relances automatiques (J+3, J+7 — planification auto)
- [x] Dashboard réponses + graphiques statistiques
- [x] Alertes email configurables (si note < seuil)
- [x] Import IA : PDF/Word → extraction questions automatique
- [x] Export réponses (CSV, PDF)
- [x] Planification automatique (rattachement auto aux sessions depuis le produit)

### Phase 5 — Commercial ✅ TERMINÉE
> **Objectif** : Pipeline commercial complet

- [x] Module **Opportunités** (pipeline, statuts, montant estimé)
- [x] Module **Devis** (CRUD, layout édition/aperçu PDF)
- [x] Multi-lignes devis + calculs auto (HT, TVA, TTC)
- [x] Conversion **devis → facture**
- [x] Envoi devis par email (Resend + tracking ouverture)
- [x] Templates de devis
- [ ] Conversion **devis → session** (à implémenter)
- [ ] Signature électronique (à évaluer : intégration externe ou maison)

### Phase 6 — Facturation ✅ TERMINÉE
> **Objectif** : Facturation complète + export comptable

- [x] Module **Factures** (CRUD, même layout que devis)
- [x] Multi-lignes + calculs auto
- [x] Suivi paiements (enregistrement, mode, solde auto)
- [x] Module **Avoirs** (lié facture, partiel/total)
- [x] **Export comptable** FEC (Fichier Écritures Comptables)
- [ ] Relances automatiques (échéance + J+7 + J+14 + J+30 via pg_cron)

### Phase 7 — Documents & Génération ✅ TERMINÉE
> **Objectif** : Génération automatique de tous les documents réglementaires

- [x] Templates de documents (convention, attestation, certificat, programme, contrat sous-traitance)
- [x] Variables dynamiques via pdf-lib
- [x] Génération PDF côté serveur (convention, attestation, convocation, émargement)
- [x] Gestion documents par entité (upload + téléchargement)
- [x] Génération par lot (toutes les attestations/convocations d'une session)

### Phase 8 — Accès, Rôles & Multi-organisation ✅ TERMINÉE
> **Objectif** : Système complet de gestion des accès et rôles

- [x] Migration BDD : `user_organisations`, `extranet_acces`, `apprenants.extranet_*`
- [x] **RBAC back-office** : permissions admin / manager / user (navigation conditionnelle, protection Server Actions)
- [x] **Middleware routing par rôle** : détection utilisateur vs extranet → redirection automatique (avec cache Redis 5min)
- [x] **Flux d'invitation extranet** : créer compte Auth + envoyer email (Resend) + activation MDP
- [x] UI d'invitation sur les fiches formateur/apprenant/contact client
- [x] **Sélecteur d'organisation** dans la sidebar pour super-admin
- [x] **Vue Admin plateforme** (`/admin`) : liste OF, stats globales, tickets de tous les OF, utilisateurs
- [x] Gestion utilisateurs dans Paramètres OF (inviter, modifier rôle, désactiver)

### Phase 9 — Extranet Formateur ✅ TERMINÉE
> **Objectif** : Espace connecté pour les formateurs

- [x] Layout extranet formateur (sidebar dédiée emerald, header, design adapté)
- [x] **Tableau de bord** : prochaines sessions, alertes, stats personnelles
- [x] **Mes sessions** : liste sessions assignées + détail (apprenants, créneaux, lieu)
- [x] **Planning** : calendrier de ses interventions
- [x] **Disponibilités** : déclarer dispos (calendrier éditable)
- [x] **Documents** : contrats, conventions, ressources pédagogiques à déposer
- [x] **Facturation** : créer factures vers l'OF (montant pré-calculé tarif jour × nb jours)
- [x] **Questionnaires** : évaluations formateur à remplir
- [x] **Messagerie** : chat temps réel avec admin et apprenants
- [x] **Tickets** : support intégré
- [x] **Mon profil** : modifier coordonnées, compétences, SIRET, NDA

### Phase 10 — Extranet Apprenant ✅ TERMINÉE
> **Objectif** : Espace connecté pour les apprenants

- [x] Layout extranet apprenant (sidebar dédiée bleue)
- [x] **Tableau de bord** : sessions en cours, prochains créneaux
- [x] **Mes sessions** : sessions inscrites, statut d'inscription
- [x] **Planning** : vue calendrier des créneaux
- [x] **Émargement** : signer sa présence quand créneau ouvert
- [x] **Documents** : conventions, attestations, certificats à télécharger
- [x] **Questionnaires** : satisfaction + évaluations pédagogiques
- [x] **Messagerie** : chat temps réel avec formateurs et admin
- [x] **Tickets** : support intégré
- [x] **Mon profil** : modifier ses infos

### Phase 11 — Extranet Contact Client ✅ TERMINÉE
> **Objectif** : Espace connecté pour les contacts clients (commanditaires)

- [x] Layout extranet contact client (sidebar dédiée violette)
- [x] **Tableau de bord** : sessions en cours, devis en attente
- [x] **Sessions** : suivi sessions commanditées (statut, apprenants, progression)
- [x] **Devis** : consulter devis
- [x] **Factures** : consulter, statut paiement
- [x] **Documents** : conventions, attestations
- [x] **Messagerie** : chat temps réel avec admin
- [x] **Tickets** : support intégré
- [ ] **Signature électronique devis** (à implémenter)

### Phase 12 — Messagerie temps réel ✅ TERMINÉE
> **Objectif** : Chat entre admin, formateurs et apprenants

- [x] Migration BDD : `conversations`, `conversation_participants`, `messages`
- [x] **Supabase Realtime** : écoute INSERT sur messages via publication
- [x] UI chat dans les 3 espaces extranet (MessagerieView + ConversationList + ChatWindow)
- [x] Conversations directes (1-to-1), groupes session, support
- [x] Pièces jointes (fichiers via Supabase Storage)
- [x] Indicateur messages non lus
- [x] Envoi optimiste (affichage immédiat avant confirmation serveur)
- [x] Server Actions : 10 fonctions (getMyConversations, sendMessage, createDirectConversation, etc.)

### Phase 13 — Vitrines OF ⭐ NOUVEAU
> **Objectif** : Site vitrine public pour chaque OF, connecté à la BDD

- [ ] **Nouveau projet Next.js** pour les vitrines (déployé séparément sur Coolify)
- [ ] **Multi-tenant par domaine** : middleware détecte Host → trouve l'organisation → affiche ses données
- [ ] Pages : accueil, catalogue formations, fiche formation `/formations/[slug]`, inscription publique
- [ ] **Blog / Articles** : éditeur riche côté back-office, publication côté vitrine
- [ ] Migration BDD : champs vitrine sur `organisations` + table `articles`
- [ ] ISR (Incremental Static Regeneration) pour SEO et performance
- [ ] Configuration vitrine dans Paramètres OF (sous-domaine, domaine custom, couleurs, logo)
- [ ] `candco.fr` = première vitrine déployée (C&CO Formation)
- [ ] Support domaines custom (CNAME) pour les OF clients

### Phase 14 — Automatisations & Suivi
> **Objectif** : Workflows automatisés + dashboard + reporting

- [ ] **Automatisations** : workflows configurables (inscription → convocation → rappel → émargement → attestation → satisfaction)
- [ ] **BPF** : génération automatique du Bilan Pédagogique et Financier
- [ ] **Dashboard / Indicateurs** : KPIs (CA, taux remplissage, rentabilité, satisfaction moyenne)
- [ ] **Rapports** : exports personnalisables
- [ ] **Emails envoyés** : historique avec statuts (délivré, ouvert)
- [ ] **Tickets** : support interne par OF

### Phase 15 — Polish & Tests
> **Objectif** : Finitions et qualité

- [ ] **Paramètres OF** complets (6 sections)
- [ ] Tests E2E
- [ ] Optimisation performances
- [ ] Documentation utilisateur

---

## 8. INSTRUCTIONS POUR CLAUDE CODE

### Règles générales

1. **Next.js 16** avec App Router — PAS de Pages Router
2. **TypeScript strict** partout — aucun `any`
3. **Server Components par défaut** — Client Components uniquement quand nécessaire (interactivité)
4. **Server Actions** pour toutes les mutations BDD
5. **API Routes** uniquement pour : webhooks, génération PDF, intégrations externes
6. **Supabase client** : `@supabase/ssr` pour le SSR, pas le client browser
7. **RLS activé** sur toutes les tables — filtrage par `organisation_id`
8. **Pas de Edge Functions** — tout dans Next.js

### Structure de fichiers recommandée

```
src/
├── app/
│   ├── (auth)/                    # Pages login/register (sans sidebar)
│   │   ├── layout.tsx
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/               # Back-office admin OF (avec sidebar admin)
│   │   ├── layout.tsx             # Sidebar 7 sections + Header + org selector
│   │   ├── page.tsx               # Dashboard principal
│   │   ├── apprenants/
│   │   │   ├── page.tsx           # Liste
│   │   │   └── [id]/
│   │   │       └── page.tsx       # Détail avec onglets
│   │   ├── entreprises/
│   │   ├── contacts-clients/
│   │   ├── formateurs/
│   │   ├── financeurs/
│   │   ├── produits/
│   │   ├── sessions/
│   │   ├── planning/
│   │   ├── questionnaires/
│   │   ├── devis/
│   │   ├── factures/
│   │   ├── avoirs/
│   │   ├── opportunites/
│   │   ├── taches/
│   │   ├── messagerie/            # Chat côté admin
│   │   ├── parametres/
│   │   └── ...
│   ├── (extranet)/                # Espaces connectés externes
│   │   ├── formateur/
│   │   │   ├── layout.tsx         # Sidebar formateur dédiée
│   │   │   ├── page.tsx           # Tableau de bord formateur
│   │   │   ├── sessions/
│   │   │   ├── planning/
│   │   │   ├── disponibilites/
│   │   │   ├── documents/
│   │   │   ├── facturation/
│   │   │   ├── messagerie/
│   │   │   └── profil/
│   │   ├── apprenant/
│   │   │   ├── layout.tsx         # Sidebar apprenant dédiée
│   │   │   ├── page.tsx           # Tableau de bord apprenant
│   │   │   ├── sessions/
│   │   │   ├── planning/
│   │   │   ├── emargement/
│   │   │   ├── documents/
│   │   │   ├── questionnaires/
│   │   │   ├── messagerie/
│   │   │   └── profil/
│   │   └── client/
│   │       ├── layout.tsx         # Sidebar contact client dédiée
│   │       ├── page.tsx           # Tableau de bord client
│   │       ├── sessions/
│   │       ├── devis/
│   │       ├── factures/
│   │       ├── documents/
│   │       └── messagerie/
│   ├── (admin)/                   # Vue super-admin plateforme
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Dashboard global (stats, OF, tickets)
│   │   ├── organisations/         # Liste de tous les OF
│   │   └── tickets/               # Tickets de tous les OF
│   ├── api/
│   │   ├── ai/                    # Import PDF IA, génération images
│   │   ├── webhooks/
│   │   ├── emails/
│   │   ├── documents/
│   │   └── export/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── layout/
│   │   ├── Sidebar.tsx            # Sidebar admin (back-office)
│   │   ├── SidebarFormateur.tsx   # Sidebar formateur (extranet)
│   │   ├── SidebarApprenant.tsx   # Sidebar apprenant (extranet)
│   │   ├── SidebarClient.tsx      # Sidebar contact client (extranet)
│   │   ├── Header.tsx
│   │   ├── Breadcrumb.tsx
│   │   └── OrgSelector.tsx        # Sélecteur d'organisation (super-admin)
│   ├── data-table/                # Table générique réutilisable
│   │   ├── DataTable.tsx
│   │   ├── columns.tsx
│   │   ├── toolbar.tsx
│   │   └── view-selector.tsx
│   ├── chat/                      # Composants messagerie
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageInput.tsx
│   │   └── ConversationList.tsx
│   ├── forms/                     # Formulaires réutilisables
│   └── shared/                    # Composants partagés
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Supabase browser client
│   │   ├── server.ts              # Supabase server client
│   │   ├── admin.ts               # Supabase admin client (service role)
│   │   └── middleware.ts          # Auth + routing par rôle
│   ├── permissions.ts             # RBAC : vérification permissions par rôle
│   ├── utils.ts
│   ├── types.ts                   # Types TypeScript générés depuis Supabase
│   └── constants.ts
├── actions/                       # Server Actions par module
│   ├── auth.ts                    # Register, login
│   ├── extranet.ts                # Invitations, activation, gestion accès
│   ├── messagerie.ts              # Conversations, messages
│   ├── apprenants.ts
│   ├── entreprises.ts
│   ├── sessions.ts
│   └── ...
└── hooks/                         # Custom hooks
    ├── use-realtime-messages.ts   # Hook Supabase Realtime pour le chat
    └── ...
```

**Projet vitrine (repo séparé — Phase 13) :**
```
candco-vitrines/
├── src/app/
│   ├── page.tsx                   # Accueil OF
│   ├── formations/
│   │   ├── page.tsx               # Catalogue
│   │   └── [slug]/page.tsx        # Fiche formation
│   ├── inscription/
│   │   └── [sessionId]/page.tsx   # Formulaire inscription public
│   ├── blog/
│   │   ├── page.tsx               # Liste articles
│   │   └── [slug]/page.tsx        # Article
│   └── contact/page.tsx
├── src/lib/
│   └── supabase/                  # Même config Supabase, lecture seule
└── src/middleware.ts               # Détection Host → organisation_id
```

### Pattern pour chaque module CRUD

Chaque module doit implémenter le même pattern :

1. **Page liste** (`page.tsx`) :
   - DataTable avec colonnes configurables
   - Barre de recherche + filtres + recherche avancée
   - Vues sauvegardées (onglets)
   - Pagination serveur (25/page)
   - Actions groupées (sélection multiple)
   - Bouton "+ Ajouter" → modale ou page

2. **Page détail** (`[id]/page.tsx`) :
   - Header avec ID affiché + actions (Archiver, Supprimer)
   - Onglets (selon le module)
   - Panneau latéral droit (tâches, relations, accès)
   - Édition inline ou modale

3. **Server Actions** (`actions/module.ts`) :
   - create, update, archive, delete
   - Validation avec Zod
   - Gestion des erreurs

4. **Types** (`lib/types.ts`) :
   - Générés automatiquement depuis Supabase (`npx supabase gen types typescript`)

### Numérotation automatique

```typescript
// Fonction pour générer le prochain numéro d'affichage
async function getNextNumero(organisationId: string, entite: string): Promise<string> {
  // Incrémente le compteur dans la table sequences
  // Retourne le numéro formaté : APP-0325, ENT-0057, etc.
  // Pour les devis/factures : D-2026-0034, F-2026-0016
}
```

---

## 9. MODULES NON DOCUMENTÉS (à prévoir)

Ces modules n'ont pas eu de captures SmartOF mais sont dans le menu :

| Module | Priorité | Notes |
|--------|----------|-------|
| Planning (vue calendrier) | Haute | Vue semaine/mois des créneaux sessions |
| Inscriptions (vue dédiée) | Moyenne | Peut-être juste une vue filtrée des inscriptions |
| Indicateurs / Dashboard | Haute | KPIs : CA, taux remplissage, rentabilité, satisfaction |
| Rapports | Moyenne | Exports personnalisables |
| BPF (module dédié) | Haute | Génération auto du Bilan Pédagogique et Financier |
| Automatisations | Basse | Workflows configurables (phase 8) |
| Opportunités commerciales | Moyenne | Pipeline commercial |
| Salles | Basse | Gestion ressources physiques |
| Formulaires administratifs | Basse | Templates docs réglementaires |

---

## 10. FEATURES KILLER (avantages vs SmartOF)

| Feature | Description | SmartOF a ça ? |
|---------|-------------|----------------|
| **Import PDF IA** | Upload PDF programme → remplissage auto des champs | Non |
| **Images IA** | Génération d'images IA pour les formations | Non |
| **Barre de progression** | Complétion visuelle des fiches (95%, 2 manquants) | Non |
| **Design Cursor** | Interface moderne noir/gris/orange, pas le violet générique | Non |
| **Self-hosted** | Contrôle total, pas de dépendance SaaS | Non (SaaS) |
| **Import IA questionnaires** | PDF/Word → extraction auto des questions | Non |
| **Analyse IA réponses** | Synthèse et insights automatiques des réponses libres | Non |
| **Signature électronique** | Intégrée nativement (à évaluer) | Non |
| **Templates devis** | Modèles réutilisables | Non |
| **Relances intelligentes** | Automatiques avec tracking | Basique |
| **Vitrines OF auto** | Chaque OF peut avoir son site vitrine connecté à la BDD, sous-domaine ou domaine custom | Non |
| **Espace formateur** | Planning, dispos, facturation vers l'OF, messagerie | Basique |
| **Espace apprenant** | Émargement en ligne, certificats, suivi sessions, messagerie | Non |
| **Espace contact client** | Suivi sessions, signature devis, consultation factures | Non |
| **Messagerie temps réel** | Chat intégré entre admin, formateurs et apprenants (Supabase Realtime) | Non |
| **Multi-org admin** | Super-admin peut switcher entre organisations et aider les OF | Non |
| **Inscription publique** | Les apprenants s'inscrivent directement depuis la vitrine OF | Non |

---

## RÉSUMÉ EXÉCUTIF

- **15 modules documentés** à partir de captures SmartOF + **section accès/rôles**
- **~55 tables** dans le schéma BDD v2
- **16 phases de développement** (Phases 0-3 terminées/en cours, Phases 4-15 à faire)
- **2 domaines** : `candco.fr` (vitrine) + `app.candco.fr` (plateforme SaaS)
- **6 types d'utilisateurs** : visiteur, admin OF, manager, formateur, apprenant, contact client + super-admin
- **Stack** : Next.js 16 + Supabase self-hosted + Coolify + Resend
- **Design** : Style Cursor (Noir / Gris / Orange)
- **Avantage concurrentiel** : IA intégrée + espaces extranet + vitrines OF + messagerie temps réel
- **Claude Code** exécute le développement

> Ce document est la référence unique pour le développement. Toute décision technique doit s'y référer.
