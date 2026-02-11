# Deploiement Documenso Self-Hosted sur Coolify

## 1. Creer le service dans Coolify

1. Dashboard Coolify → **+ New Resource** → **Docker Compose**
2. Coller le contenu de `compose.yml` ci-dessous
3. Configurer le domaine : `sign.candco.fr`
4. Configurer les variables d'environnement
5. Deploy

## 2. Variables d'environnement requises

```env
# ─── Securite ───────────────────────────────
NEXTAUTH_SECRET=<generer avec: openssl rand -base64 32>
NEXT_PRIVATE_ENCRYPTION_KEY=<generer avec: openssl rand -base64 32>
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=<generer avec: openssl rand -base64 32>

# ─── URL publique ───────────────────────────
NEXT_PUBLIC_WEBAPP_URL=https://sign.candco.fr
PORT=3000

# ─── Base de donnees ────────────────────────
# Option A : BDD dediee (recommande)
POSTGRES_USER=documenso
POSTGRES_PASSWORD=<mot de passe fort>
POSTGRES_DB=documenso
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

# ─── Desactiver inscription publique ────────
NEXT_PUBLIC_DISABLE_SIGNUP=true
```

## 3. Generer le certificat de signature

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

## 4. Creer une API Key

1. Aller sur `https://sign.candco.fr`
2. Se connecter (premier utilisateur = admin)
3. Settings → API Tokens → Create Token
4. Copier la cle API
5. Ajouter dans le `.env` de la plateforme C&CO :
   ```
   DOCUMENSO_API_URL=https://sign.candco.fr
   DOCUMENSO_API_KEY=<cle API>
   ```

## 5. Verifier le deploiement

```bash
curl https://sign.candco.fr/api/health
# Doit retourner : {"status":"ok"}

curl https://sign.candco.fr/api/certificate-status
# Doit retourner des infos sur le certificat
```
