/**
 * Client API Documenso v2 pour C&CO Formation
 *
 * Gere la communication avec l'instance Documenso self-hosted
 * pour la signature electronique de devis et conventions.
 */

const DOCUMENSO_API_URL = process.env.DOCUMENSO_API_URL || "";
const DOCUMENSO_API_KEY = process.env.DOCUMENSO_API_KEY || "";

// ─── Types ──────────────────────────────────────────────

export interface DocumensoRecipient {
  name: string;
  email: string;
  role: "SIGNER" | "APPROVER" | "CC";
  signingOrder?: number;
}

export interface DocumensoField {
  recipientId: number;
  type: "SIGNATURE" | "DATE" | "NAME" | "EMAIL" | "TEXT";
  pageNumber: number;
  pageX: number; // Position X (percentage 0-100)
  pageY: number; // Position Y (percentage 0-100)
  pageWidth: number;
  pageHeight: number;
}

export interface DocumensoEnvelope {
  id: number;
  externalId?: string;
  status: "DRAFT" | "PENDING" | "COMPLETED" | "REJECTED" | "EXPIRED";
  title: string;
  createdAt: string;
  updatedAt: string;
  recipients?: DocumensoEnvelopeRecipient[];
}

export interface DocumensoEnvelopeRecipient {
  id: number;
  email: string;
  name: string;
  role: string;
  signingStatus: "NOT_SIGNED" | "SIGNED" | "REJECTED";
  signingUrl?: string;
  signedAt?: string;
}

// ─── API Client ─────────────────────────────────────────

function getHeaders(): HeadersInit {
  if (!DOCUMENSO_API_KEY) {
    throw new Error("DOCUMENSO_API_KEY non configurée");
  }
  return {
    Authorization: `Bearer ${DOCUMENSO_API_KEY}`,
  };
}

function getJsonHeaders(): HeadersInit {
  return {
    ...getHeaders(),
    "Content-Type": "application/json",
  };
}

async function documensoFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!DOCUMENSO_API_URL) {
    throw new Error("DOCUMENSO_API_URL non configurée");
  }

  const url = `${DOCUMENSO_API_URL}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Documenso API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

// ─── Check configuration ────────────────────────────────

export function isDocumensoConfigured(): boolean {
  return !!(DOCUMENSO_API_URL && DOCUMENSO_API_KEY);
}

export async function checkDocumensoHealth(): Promise<{
  available: boolean;
  status?: string;
  error?: string;
}> {
  if (!isDocumensoConfigured()) {
    return { available: false, error: "Non configuré" };
  }

  try {
    const response = await fetch(`${DOCUMENSO_API_URL}/api/health`, {
      next: { revalidate: 60 },
    });
    const data = await response.json();
    return { available: data.status === "ok", status: data.status };
  } catch (err) {
    return {
      available: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    };
  }
}

// ─── Create envelope with PDF ───────────────────────────

export async function createEnvelopeFromPdf(params: {
  title: string;
  pdfUrl: string;
  recipients: DocumensoRecipient[];
  externalId?: string;
}): Promise<DocumensoEnvelope> {
  // Download the PDF first
  const pdfResponse = await fetch(params.pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Impossible de télécharger le PDF : ${params.pdfUrl}`);
  }
  const pdfBlob = await pdfResponse.blob();

  // Build multipart form
  const formData = new FormData();

  const payload = {
    title: params.title,
    type: "DOCUMENT",
    externalId: params.externalId || undefined,
    recipients: params.recipients.map((r, idx) => ({
      name: r.name,
      email: r.email,
      role: r.role,
      signingOrder: r.signingOrder ?? idx + 1,
      fields: [
        {
          type: "SIGNATURE",
          pageNumber: 1,
          pageX: 10,
          pageY: 80,
          pageWidth: 30,
          pageHeight: 5,
        },
        {
          type: "DATE",
          pageNumber: 1,
          pageX: 45,
          pageY: 80,
          pageWidth: 20,
          pageHeight: 3,
        },
      ],
    })),
  };

  formData.append("payload", JSON.stringify(payload));
  formData.append("file", pdfBlob, `${params.title}.pdf`);

  const response = await fetch(`${DOCUMENSO_API_URL}/api/v2/envelope/create`, {
    method: "POST",
    headers: getHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur création enveloppe Documenso (${response.status}): ${text}`);
  }

  return response.json() as Promise<DocumensoEnvelope>;
}

// ─── Send envelope for signing ──────────────────────────

export async function distributeEnvelope(envelopeId: number): Promise<void> {
  await documensoFetch("/api/v2/envelope/distribute", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ envelopeId }),
  });
}

// ─── Get envelope details ───────────────────────────────

export async function getEnvelope(envelopeId: number): Promise<DocumensoEnvelope> {
  return documensoFetch<DocumensoEnvelope>(`/api/v2/envelope/${envelopeId}`);
}

// ─── Full workflow: Create + Send ───────────────────────

export async function sendDocumentForSigning(params: {
  title: string;
  pdfUrl: string;
  recipients: DocumensoRecipient[];
  externalId?: string;
}): Promise<{
  envelopeId: number;
  envelope: DocumensoEnvelope;
}> {
  // Step 1: Create envelope with PDF and recipients
  const envelope = await createEnvelopeFromPdf(params);

  // Step 2: Distribute (send for signing)
  await distributeEnvelope(envelope.id);

  return {
    envelopeId: envelope.id,
    envelope,
  };
}
