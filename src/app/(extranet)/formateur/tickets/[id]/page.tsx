"use client";

import { useParams } from "next/navigation";
import { ExtranetTicketDetail } from "@/components/extranet/ExtranetTicketDetail";

export default function FormateurTicketDetailPage() {
  const params = useParams();
  return <ExtranetTicketDetail ticketId={params.id as string} basePath="/extranet/formateur/tickets" />;
}
