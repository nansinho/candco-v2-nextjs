import { ToastProvider } from "@/components/ui/toast";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col pl-[240px] transition-all duration-300">
          <Header />
          <main className="flex-1 px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
