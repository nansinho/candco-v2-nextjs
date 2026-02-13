# Deploiement Documenso Self-Hosted sur Coolify

## 1. Creer le service dans Coolify

1. Dashboard Coolify → **+ New Resource** → **Docker Compose**
2. Coller le contenu de `compose.yml` ci-dessous
3. Configurer le domaine : `documenso.candco.fr`
4. Configurer les variables d'environnement
5. Deploy

## 2. Docker Compose (Documenso + MinIO)

MinIO est **obligatoire** pour l'API v1 de Documenso. Le code source de Documenso
(`packages/api/v1/implementation.ts`) exige `NEXT_PUBLIC_UPLOAD_TRANSPORT=s3` pour
les endpoints `createDocument`, `downloadSignedDocument` et `createTemplate`.
Sans S3, l'API retourne : `"Create document is not available without S3 transport."`

```yaml
services:
  documenso:
    image: documenso/documenso:latest
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - database
      - minio

  database:
    image: postgres:15
    environment:
      POSTGRES_USER: documenso
      POSTGRES_PASSWORD: <mot_de_passe_fort>
      POSTGRES_DB: documenso
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: documenso
      MINIO_ROOT_PASSWORD: <mot_de_passe_minio>
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

volumes:
  postgres_data:
  minio_data:
```

## 3. Configurer MinIO

Apres le premier deploiement :

1. Acceder a la console MinIO (ex: `https://console-k8co4ko4w4koccg4w0k4440s.45.133.178.50.sslip.io`)
2. Se connecter avec `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`
3. Creer un bucket nomme `documenso`
4. **IMPORTANT** : Mettre la access policy du bucket en **Public** (Object Browser → bucket → Manage → Access Policy → Public). Sans ca, les presigned URLs retournent 403 AllAccessDisabled.
5. (Optionnel) Creer un access key dedie dans **Identity → Service Accounts**

## 4. Variables d'environnement requises

```env
# ─── Securite ───────────────────────────────
NEXTAUTH_SECRET=<generer avec: openssl rand -base64 32>
NEXT_PRIVATE_ENCRYPTION_KEY=<generer avec: openssl rand -base64 32>
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=<generer avec: openssl rand -base64 32>

# ─── URL publique ───────────────────────────
NEXT_PUBLIC_WEBAPP_URL=https://documenso.candco.fr
PORT=3000

# ─── Base de donnees ────────────────────────
NEXT_PRIVATE_DATABASE_URL=postgresql://documenso:<password>@database:5432/documenso?schema=public&connection_limit=5
NEXT_PRIVATE_DIRECT_DATABASE_URL=postgresql://documenso:<password>@database:5432/documenso?schema=public

# ─── Email (reutiliser Resend) ──────────────
NEXT_PRIVATE_SMTP_TRANSPORT=resend
NEXT_PRIVATE_RESEND_API_KEY=<ta cle Resend>
NEXT_PRIVATE_SMTP_FROM_ADDRESS=signature@candco.fr
NEXT_PRIVATE_SMTP_FROM_NAME=C&CO Formation - Signature

# ─── Certificat de signature ────────────────
NEXT_PRIVATE_SIGNING_TRANSPORT=local
NEXT_PRIVATE_SIGNING_PASSPHRASE=<mot de passe certificat>
NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH=/opt/documenso/cert.p12

# ─── Stockage S3/MinIO (OBLIGATOIRE pour l'API v1) ──
# L'API Documenso v1 EXIGE S3. Le mode "database" ne fonctionne
# que pour l'interface web, PAS pour les endpoints API.
# Ref: packages/api/v1/implementation.ts → hard check sur cette variable
#
# ATTENTION : les variables sont SANS "_S3" dans le nom !
# NEXT_PRIVATE_UPLOAD_ENDPOINT (pas NEXT_PRIVATE_UPLOAD_S3_ENDPOINT)
NEXT_PUBLIC_UPLOAD_TRANSPORT=s3
NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID=documenso
NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY=<mot_de_passe_minio>
NEXT_PRIVATE_UPLOAD_REGION=us-east-1
NEXT_PRIVATE_UPLOAD_BUCKET=documenso
NEXT_PRIVATE_UPLOAD_ENDPOINT=https://minio-k8co4ko4w4koccg4w0k4440s.45.133.178.50.sslip.io
NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE=true

# ─── Desactiver inscription publique ────────
NEXT_PUBLIC_DISABLE_SIGNUP=true
```

## 5. Generer le certificat de signature

Apres le premier deploiement, executer dans le container :

```bash
docker exec -it <container_documenso> sh

# Generer un certificat auto-signe
openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout /tmp/key.pem \
  -out /tmp/cert.pem \
  -days 3650 \
  -subj "/CN=C&CO Formation/O=C&CO Formation"

# Convertir en PKCS12
openssl pkcs12 -export \
  -in /tmp/cert.pem \
  -inkey /tmp/key.pem \
  -out /opt/documenso/cert.p12 \
  -passout pass:<SIGNING_PASSPHRASE>

# Nettoyer
rm /tmp/key.pem /tmp/cert.pem
```

## 6. Creer une API Key

1. Aller sur `https://documenso.candco.fr`
2. Se connecter (premier utilisateur = admin)
3. Settings → API Tokens → Create Token
4. Copier la cle API
5. Ajouter dans le `.env` de la plateforme C&CO :
   ```
   DOCUMENSO_API_URL=https://documenso.candco.fr
   DOCUMENSO_API_KEY=<cle API>
   DOCUMENSO_WEBHOOK_SECRET=<secret partage pour les webhooks>
   ```

## 7. Configurer le webhook

Dans l'interface Documenso (`https://documenso.candco.fr`) :

1. Settings → Webhooks → Add Webhook
2. URL : `https://app.candco.fr/api/webhooks/documenso`
3. Events : `ENVELOPE_COMPLETED`, `ENVELOPE_REJECTED`
4. Secret : doit correspondre a `DOCUMENSO_WEBHOOK_SECRET` dans le `.env` C&CO

## 8. Verifier le deploiement

```bash
curl https://documenso.candco.fr/api/health
# Doit retourner : {"status":"ok"}

curl https://documenso.candco.fr/api/certificate-status
# Doit retourner des infos sur le certificat
```

## 9. Tester l'envoi d'un devis

1. Creer un devis dans le dashboard C&CO
2. Cliquer "Envoyer le devis"
3. Le statut doit passer a "envoye"
4. Le destinataire doit recevoir un email avec un lien de signature
