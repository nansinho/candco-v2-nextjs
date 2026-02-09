import { PlanningClient } from "@/components/planning/planning-client";

export default function PlanningPage() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-100px)]">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Planning</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visualisez le planning des sessions, créneaux et disponibilités des formateurs
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <PlanningClient />
      </div>
    </div>
  );
}
