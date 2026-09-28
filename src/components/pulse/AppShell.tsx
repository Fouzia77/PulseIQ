import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Dashboard" },
  { to: "/explorer", label: "Explorer" },
  { to: "/analyze", label: "Analyze" },
] as const;

export function AppShell({ children, signals }: { children: ReactNode; signals?: number }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background font-body text-foreground">
      <div className="pointer-events-none absolute -top-40 -left-40 size-[520px] rounded-full bg-accent/20 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/3 -right-40 size-[460px] rounded-full bg-indigo/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 size-[420px] rounded-full bg-indigo/10 blur-[120px]" />

      <header className="relative z-10 flex items-center justify-between px-8 py-5">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-lg border border-accent/40 bg-accent/15 font-display text-lg font-bold text-accent">
            P
          </div>
          <div>
            <div className="font-display text-lg leading-none font-bold tracking-tight">
              PulseIQ
            </div>
            <div className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              Sentiment Memory
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-md px-3 py-1.5 transition-colors hover:text-foreground"
              activeProps={{ className: "bg-foreground/5 text-foreground" }}
              activeOptions={{ exact: item.to === "/" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <div className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            Live · {signals ?? 0} signals
          </div>
        </div>
      </header>

      <main className="relative z-10 space-y-6 px-8 pb-16">{children}</main>
    </div>
  );
}
