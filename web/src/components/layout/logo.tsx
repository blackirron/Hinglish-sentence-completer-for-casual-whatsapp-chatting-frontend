import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <path d="M6 5h20a4 4 0 0 1 4 4v11a4 4 0 0 1-4 4H15l-6 5v-5H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" fill="currentColor" />
      <circle cx="10.5" cy="14.5" r="1.7" fill="#fff" />
      <circle cx="16" cy="14.5" r="1.7" fill="#fff" />
      <circle cx="21.5" cy="14.5" r="1.7" fill="#fff" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-primary", className)}>
      <LogoMark />
      <span className="text-xl font-bold tracking-tight text-foreground">
        complete<span className="text-primary">.io</span>
      </span>
    </span>
  );
}
