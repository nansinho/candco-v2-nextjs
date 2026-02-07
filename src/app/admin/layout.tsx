import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { ToastProvider } from "@/components/ui/toast";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user || !user.is_super_admin) {
    redirect("/");
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        {/* Admin header */}
        <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                C&CO
              </div>
              <div>
                <h1 className="text-sm font-semibold">Admin Plateforme</h1>
                <p className="text-xs text-muted-foreground">
                  Gestion globale de tous les OF
                </p>
              </div>
            </div>
            <nav className="flex items-center gap-4">
              <a
                href="/admin"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </a>
              <a
                href="/admin/organisations"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Organisations
              </a>
              <a
                href="/admin/tickets"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Tickets
              </a>
              <a
                href="/"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                Retour au back-office
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
