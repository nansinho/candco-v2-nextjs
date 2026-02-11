"use client";

import { useParams } from "next/navigation";
import { ExtranetTicketDetail } from "@/components/extranet/ExtranetTicketDetail";

export default function ClientTicketDetailPage() {
  const params = useParams();
  return <ExtranetTicketDetail ticketId={params.id as string} basePath="/extranet/client/tickets" />;
}
