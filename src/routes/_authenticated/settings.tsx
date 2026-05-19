import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { exportData } from "@/lib/borrowings.functions";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogOut, Download, Info } from "lucide-react";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const exp = useServerFn(exportData);

  const [vibrationEnabled, setVibrationEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("lendledger_vibration") !== "false";
    }
    return true;
  });

  const toggleVibration = () => {
    const nextVal = !vibrationEnabled;
    setVibrationEnabled(nextVal);
    localStorage.setItem("lendledger_vibration", String(nextVal));
    if (nextVal) {
      vibrate(HAPTIC_PATTERNS.BUTTON_TAP);
    }
  };

  async function handleExport() {
    try {
      const data = await exp();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
      vibrate(HAPTIC_PATTERNS.ERROR_FAILED);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-4 md:px-8 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 max-w-2xl mx-auto w-full">
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>
      <main className="px-4 md:px-8 py-5 max-w-2xl mx-auto w-full space-y-3">
        <Section title="Appearance" desc="Switch between light and dark themes.">
          <ThemeToggle />
        </Section>

        <Section title="Haptic Feedback" desc="Feel vibrations for payments and actions">
          <button
            type="button"
            onClick={toggleVibration}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              vibrationEnabled ? "bg-[#00C853]" : "bg-muted-foreground/30"
            }`}
            role="switch"
            aria-checked={vibrationEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow ring-0 transition duration-200 ease-in-out ${
                vibrationEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </Section>

        <Section title="Account" desc={user?.email ?? ""}>
          <Button variant="outline" className="rounded-xl" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </Section>

        <Section title="Backup" desc="Download all your borrowings and payments as JSON.">
          <Button variant="outline" className="rounded-xl" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export data
          </Button>
        </Section>

        <Section title="About" desc="Ledger — a calm tracker for lent money and installment repayments.">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Info className="h-3 w-3" /> v1.0
          </p>
        </Section>
      </main>
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="min-w-0">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground mt-0.5 break-words">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
