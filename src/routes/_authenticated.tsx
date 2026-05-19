import { createFileRoute, Outlet, useNavigate, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Home, CheckCircle2, Settings, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listBorrowings } from "@/lib/borrowings.functions";
import { motion, AnimatePresence } from "framer-motion";
import { vibrate, HAPTIC_PATTERNS } from "@/lib/haptics";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/home", label: "Active", icon: Home },
  { to: "/completed", label: "Completed", icon: CheckCircle2 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function debounce<T extends (...args: any[]) => void>(fn: T, delay = 300): T {
  let timer: any = null;
  return ((...args: any[]) => {
    if (timer) return;
    fn(...args);
    timer = setTimeout(() => {
      timer = null;
    }, delay);
  }) as any;
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const handleNav = useRef(
    debounce((to: any) => {
      navigate({ to });
    }, 300)
  ).current;

  const list = useServerFn(listBorrowings);
  const { data } = useQuery({
    queryKey: ["borrowings"],
    queryFn: () => list(),
    enabled: !!user,
  });

  const completedCount = useMemo(() => (data ?? []).filter((b) => b.completed).length, [data]);
  const [bounceCompleted, setBounceCompleted] = useState(false);
  const prevCompletedCount = useRef(completedCount);

  useEffect(() => {
    if (completedCount > prevCompletedCount.current) {
      setBounceCompleted(true);
      const t = setTimeout(() => setBounceCompleted(false), 300);
      prevCompletedCount.current = completedCount;
      return () => clearTimeout(t);
    }
    prevCompletedCount.current = completedCount;
  }, [completedCount]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex-col">
        <div className="p-5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center">
            <Wallet className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sidebar-foreground">Ledger</span>
        </div>
        <nav className="px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={(e) => {
                  e.preventDefault();
                  vibrate(HAPTIC_PATTERNS.TAB_SWITCH);
                  handleNav(item.to);
                }}
                className={cn(
                  "flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition cursor-pointer select-none touch-action-manipulation -webkit-tap-highlight-color-transparent",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
                {item.to === "/completed" && completedCount > 0 && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-xs font-semibold rounded-full bg-success text-success-foreground border border-success-border transition-all duration-300 will-change-transform",
                      bounceCompleted && "scale-125 bg-paid-green text-white animate-[bounce-badge_0.3s_ease-out]"
                    )}
                  >
                    {completedCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={path}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-grow flex flex-col min-w-0"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[max(12px,env(safe-area-inset-bottom))]">
        <ul className="flex w-full items-stretch">
          {navItems.map((item) => {
            const active = path === item.to;
            return (
              <li key={item.to} className="flex-1 flex">
                <Link
                  to={item.to}
                  onClick={(e) => {
                    e.preventDefault();
                    vibrate(HAPTIC_PATTERNS.TAB_SWITCH);
                    handleNav(item.to);
                  }}
                  className={cn(
                    "flex-grow flex flex-col items-center justify-center gap-0.5 text-xs transition relative min-h-[56px] min-w-[48px] py-3 px-6 cursor-pointer select-none touch-action-manipulation -webkit-tap-highlight-color-transparent",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <div className="relative">
                    <item.icon className={cn("h-5 w-5", active && "text-primary")} />
                    {item.to === "/completed" && completedCount > 0 && (
                      <span
                        className={cn(
                          "absolute -top-1.5 -right-2.5 h-4 min-w-[16px] px-1 flex items-center justify-center text-[9px] font-bold rounded-full bg-success text-success-foreground border border-success-border transition-all duration-300 will-change-transform",
                          bounceCompleted && "scale-125 bg-paid-green text-white animate-[bounce-badge_0.3s_ease-out]"
                        )}
                      >
                        {completedCount}
                      </span>
                    )}
                  </div>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
