"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Bookmark, History, Info, LayoutGrid, Menu, PenLine, Settings, X, House } from "lucide-react";
import { Logo, LogoMark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { fetchStatus } from "@/lib/api";
import { ENGINE_MODE } from "@/lib/engine/config";
import { engineStore } from "@/lib/engine/browser";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/results", label: "Latest results", icon: PenLine },
  { href: "/examples", label: "Examples", icon: LayoutGrid },
  { href: "/phrases", label: "My phrases", icon: Bookmark },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
] as const;

type Status = "checking" | "ok" | "warming_up" | "not_configured" | "offline" | "idle" | "loading" | "error" | "unsupported";

function useServerStatus(): Status {
  const [status, setStatus] = React.useState<Status>("checking");
  React.useEffect(() => {
    if (ENGINE_MODE !== "server") return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const tick = async () => {
      const s = await fetchStatus(ctrl.signal);
      if (ctrl.signal.aborted) return;
      setStatus(s);
      tries += 1;
      if (s === "warming_up" && tries < 24) timer = setTimeout(tick, 8000); // free hosts can take a while to wake
    };
    tick();
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, []);
  return status;
}

function useModelStatus(): { status: Status; progress: number } {
  const server = useServerStatus();
  const engine = React.useSyncExternalStore(engineStore.subscribe, engineStore.get, engineStore.getServer);
  if (ENGINE_MODE === "server") return { status: server, progress: 0 };
  const map = { idle: "idle", loading: "loading", ready: "ok", error: "error", unsupported: "unsupported" } as const;
  return { status: map[engine.state], progress: engine.progress };
}

function StatusPill({ status, progress }: { status: Status; progress: number }) {
  const onDevice = ENGINE_MODE === "browser";
  const map: Record<Status, { text: string; dot: string }> = {
    checking: { text: "Checking model", dot: "bg-muted" },
    ok: { text: onDevice ? "Model ready, on your device" : "Model ready", dot: "bg-success" },
    warming_up: { text: "Model waking up", dot: "bg-warning animate-pulse" },
    not_configured: { text: "Model not connected", dot: "bg-danger" },
    offline: { text: "Offline", dot: "bg-danger" },
    idle: { text: "Model not loaded yet", dot: "bg-muted" },
    loading: { text: `Loading model ${Math.round(progress * 100)}%`, dot: "bg-warning animate-pulse" },
    error: { text: "Model failed to load", dot: "bg-danger" },
    unsupported: { text: "Browser not supported", dot: "bg-danger" },
  };
  const { text, dot } = map[status];
  return (
    <span role="status" className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted">
      <span className={cn("h-2 w-2 rounded-full", dot)} />
      {text}
    </span>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-soft text-soft-foreground" : "text-muted hover:bg-soft/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Tagline() {
  return (
    <div className="mt-auto rounded-2xl border border-border bg-soft/70 p-4">
      <LogoMark className="mb-2 h-6 w-6 text-primary" />
      <p className="text-sm font-semibold">Chat better, naturally.</p>
      <p className="mt-1 text-xs text-muted">Hinglish sentences, completed for you.</p>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const { status, progress } = useModelStatus();

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>

      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-border bg-surface/60 p-5 backdrop-blur lg:flex">
        <Link href="/" aria-label="complete.io home" className="px-1">
          <Logo />
        </Link>
        <NavList />
        <Tagline />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              onClick={() => setOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface"
            >
              <Menu className="h-4 w-4" />
            </button>
            <Logo />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <StatusPill status={status} progress={progress} />
            <ThemeToggle />
          </div>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu" id="mobile-menu">
            <button aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] flex-col gap-6 bg-background p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <Logo />
                <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <NavList onNavigate={() => setOpen(false)} />
              <Tagline />
            </div>
          </div>
        )}

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-8">
          {children}
        </main>
        <footer className="px-4 pb-8 text-center text-xs text-muted sm:px-8">
          {ENGINE_MODE === "browser" ? "The model runs on your device. What you type never leaves this browser, and your history stays here too." : "Your text is sent to the model server only to get a result. Nothing is stored there, and your history stays in this browser."}
        </footer>
      </div>
    </div>
  );
}
