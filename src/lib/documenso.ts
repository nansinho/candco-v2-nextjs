/**
 * Client API Documenso v1 pour C&CO Formation
 *
 * Gère la communication avec l'instance Documenso self-hosted
 * pour la signature électronique de devis et conventions.
 *
 * API v1 workflow:
 *   1. POST /api/v1/documents       → create document, get uploadUrl + documentId
 *   2. PUT  {uploadUrl}              → upload PDF binary
 *   3. POST /api/v1/documents/{id}/fields → add signature/date fields
 *   4. POST /api/v1/documents/{id}/send   → send for signing
 *   5. GET  /api/v1/documents/{id}        → check status
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

// ─── v1 API response types (internal) ───────────────────

interface V1CreateDocumentResponse {
  uploadUrl: string;
  documentId: number;
  externalId?: string | null;
  recipients: {
    recipientId: number;
    name: string;
    email: string;
    token: string;
    role: string;
    signingOrder?: number | null;
    signingUrl: string;
  }[];
}

interface V1GetDocumentResponse {
  id: number;
  externalId?: string | null;
  userId: number;
  teamId?: number | null;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  recipients: {
    id: number;
    name: string;
    email: string;
    role: string;
    signingStatus: string;
    sendStatus: string;
    signedAt?: string | null;
    token?: string;
    signingUrl?: string;
  }[];
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

// ─── Step 1: Create document (v1) ───────────────────────

async function createDocument(params: {
  title: string;
  recipients: DocumensoRecipient[];
  externalId?: string;
}): Promise<V1CreateDocumentResponse> {
  return documensoFetch<V1CreateDocumentResponse>("/api/v1/documents", {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({
      title: params.title,
      externalId: params.externalId || undefined,
      recipients: params.recipients.map((r, idx) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        signingOrder: r.signingOrder ?? idx + 1,
      })),
      meta: {
        subject: params.title,
        message: "Veuillez signer ce document.",
        language: "fr",
      },
    }),
  });
}

// ─── Step 2: Upload PDF to presigned URL ────────────────

async function uploadPdfToPresignedUrl(
  uploadUrl: string,
  pdfBuffer: ArrayBuffer,
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/pdf",
    },
    body: pdfBuffer,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erreur upload PDF vers Documenso (${response.status}): ${text}`);
  }
}

// ─── Step 3: Add fields to document ─────────────────────

async function addFieldsToDocument(
  documentId: number,
  fields: DocumensoField[],
): Promise<void> {
  await documensoFetch(`/api/v1/documents/${documentId}/fields`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify(fields.map((f) => ({
      recipientId: f.recipientId,
      type: f.type,
      pageNumber: f.pageNumber,
      pageX: f.pageX,
      pageY: f.pageY,
      pageWidth: f.pageWidth,
      pageHeight: f.pageHeight,
      fieldMeta: {},
    }))),
  });
}

// ─── Step 4: Send document for signing ──────────────────

async function sendDocument(documentId: number): Promise<void> {
  await documensoFetch(`/api/v1/documents/${documentId}/send`, {
    method: "POST",
    headers: getJsonHeaders(),
    body: JSON.stringify({ sendEmail: true }),
  });
}

// ─── Get document details (v1) ──────────────────────────

export async function getEnvelope(envelopeId: number): Promise<DocumensoEnvelope> {
  const doc = await documensoFetch<V1GetDocumentResponse>(
    `/api/v1/documents/${envelopeId}`,
  );

  return {
    id: doc.id,
    externalId: doc.externalId ?? undefined,
    status: doc.status as DocumensoEnvelope["status"],
    title: doc.title,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    recipients: (doc.recipients || []).map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      signingStatus: (r.signingStatus || "NOT_SIGNED") as DocumensoEnvelopeRecipient["signingStatus"],
      signingUrl: r.signingUrl,
      signedAt: r.signedAt ?? undefined,
    })),
  };
}

// ─── Full workflow: Create + Upload + Fields + Send ──────

export async function sendDocumentForSigning(params: {
  title: string;
  pdfUrl: string;
  recipients: DocumensoRecipient[];
  externalId?: string;
}): Promise<{
  envelopeId: number;
  envelope: DocumensoEnvelope;
}> {
  // Step 1: Download the PDF
  const pdfResponse = await fetch(params.pdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Impossible de télécharger le PDF : ${params.pdfUrl}`);
  }
  const pdfBuffer = await pdfResponse.arrayBuffer();

  // Step 2: Create document in Documenso (returns uploadUrl + documentId)
  const createResult = await createDocument({
    title: params.title,
    recipients: params.recipients,
    externalId: params.externalId,
  });

  // Step 3: Upload PDF to the presigned URL
  await uploadPdfToPresignedUrl(createResult.uploadUrl, pdfBuffer);

  // Step 4: Add signature + date fields for each recipient
  const fields: DocumensoField[] = [];
  for (const recipient of createResult.recipients) {
    fields.push(
      {
        recipientId: recipient.recipientId,
        type: "SIGNATURE",
        pageNumber: 1,
        pageX: 10,
        pageY: 80,
        pageWidth: 30,
        pageHeight: 5,
      },
      {
        recipientId: recipient.recipientId,
        type: "DATE",
        pageNumber: 1,
        pageX: 45,
        pageY: 80,
        pageWidth: 20,
        pageHeight: 3,
      },
    );
  }
  await addFieldsToDocument(createResult.documentId, fields);

  // Step 5: Send for signing
  await sendDocument(createResult.documentId);

  // Build the envelope response matching our interface
  const envelope: DocumensoEnvelope = {
    id: createResult.documentId,
    externalId: createResult.externalId ?? undefined,
    status: "PENDING",
    title: params.title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    recipients: createResult.recipients.map((r) => ({
      id: r.recipientId,
      email: r.email,
      name: r.name,
      role: r.role,
      signingStatus: "NOT_SIGNED" as const,
      signingUrl: r.signingUrl,
    })),
  };

  return {
    envelopeId: createResult.documentId,
    envelope,
  };
}
