import { getContactClient } from "@/actions/contacts-clients";
import { notFound } from "next/navigation";
import { ContactClientDetail } from "./ContactClientDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactClientPage({ params }: PageProps) {
  const { id } = await params;
  const { data, entreprises, error } = await getContactClient(id);

  if (error || !data) {
    notFound();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ContactClientDetail contact={data as any} entreprises={(entreprises ?? []) as any[]} />;
}
