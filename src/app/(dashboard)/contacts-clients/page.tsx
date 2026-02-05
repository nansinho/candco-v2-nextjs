import { Users } from "lucide-react";

export default function ContactsClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Contacts clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerez vos contacts clients, decideurs et commanditaires de formations
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-lg border border-border/60 bg-card py-20">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-sm font-medium">Module en construction</h2>
        <p className="mt-1 text-xs text-muted-foreground">Ce module sera bientot disponible</p>
      </div>
    </div>
  );
}
