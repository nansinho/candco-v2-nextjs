export interface FECEntry {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcrtureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
}

export function entriesToCSV(entries: FECEntry[]): string {
  const headers = [
    "JournalCode",
    "JournalLib",
    "EcritureNum",
    "EcritureDate",
    "CompteNum",
    "CompteLib",
    "CompAuxNum",
    "CompAuxLib",
    "PieceRef",
    "PieceDate",
    "EcritureLib",
    "Debit",
    "Credit",
    "EcrtureLet",
    "DateLet",
    "ValidDate",
    "Montantdevise",
    "Idevise",
  ];

  const rows = entries.map((entry) =>
    headers
      .map((h) => {
        const val = entry[h as keyof FECEntry] ?? "";
        // Escape if contains tab or newline
        if (val.includes("\t") || val.includes("\n")) {
          return `"${val}"`;
        }
        return val;
      })
      .join("\t"),
  );

  return [headers.join("\t"), ...rows].join("\n");
}
