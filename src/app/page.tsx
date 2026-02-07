import { redirect } from "next/navigation";

export default function RootPage() {
  // The middleware handles all routing:
  // - Authenticated internal users → /dashboard
  // - Authenticated extranet users → /extranet/{role}
  // - Unauthenticated users → /login
  // If we reach this page, redirect to dashboard as fallback
  redirect("/dashboard");
}
