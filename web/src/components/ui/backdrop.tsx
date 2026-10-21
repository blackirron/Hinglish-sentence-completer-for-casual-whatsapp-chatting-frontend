/** Soft decorative background: blurred colour washes, two slow waves and a few sparkles.
 *  Purely visual, so it is hidden from assistive tech and never takes pointer events. */
function Sparkle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12 0c.6 6.2 2.8 10.4 12 12-9.2 1.6-11.4 5.8-12 12-.6-6.2-2.8-10.4-12-12C9.2 10.4 11.4 6.2 12 0Z" />
    </svg>
  );
}

export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-32 -top-32 h-[34rem] w-[34rem] rounded-full bg-primary/10 blur-3xl dark:bg-primary/10" />
      <div className="absolute -bottom-40 -left-24 h-[30rem] w-[30rem] rounded-full bg-[#f7b6c6]/30 blur-3xl dark:bg-primary/5" />
      <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-white/50 blur-3xl dark:bg-white/0" />
      <svg className="absolute bottom-0 left-0 w-full text-primary" viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ height: "42vh" }}>
        <path className="opacity-[0.07] dark:opacity-[0.06]" fill="currentColor" d="M0 160c120-60 240-80 360-50s240 100 360 90 240-100 360-110 240 40 360 80v210H0Z" />
        <path className="opacity-[0.05] dark:opacity-[0.04]" fill="currentColor" d="M0 220c160-70 300-60 440-20s280 80 440 50 300-90 560-40v110H0Z" />
      </svg>
      <Sparkle className="absolute right-[9%] top-[14%] h-5 w-5 text-primary/30" />
      <Sparkle className="absolute right-[22%] top-[8%] h-3 w-3 text-primary/25" />
      <Sparkle className="absolute bottom-[22%] right-[14%] h-4 w-4 text-primary/20" />
      <Sparkle className="absolute bottom-[30%] left-[30%] h-3 w-3 text-primary/20" />
    </div>
  );
}

/** Chat bubble illustration for the home hero, drawn in SVG so it stays sharp and light. */
export function HeroArt({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <svg viewBox="0 0 240 200" className="h-full w-full drop-shadow-[0_18px_28px_rgba(168,50,78,0.22)]">
        <defs>
          <linearGradient id="bubble" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd3dd" />
            <stop offset="1" stopColor="#f08aa4" />
          </linearGradient>
          <linearGradient id="bubble2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff" />
            <stop offset="1" stopColor="#ffe3ea" />
          </linearGradient>
        </defs>
        <path d="M150 60c0-14 11-24 25-24h40c14 0 25 10 25 24v26c0 14-11 24-25 24h-8l-12 16-4-16h-16c-14 0-25-10-25-24Z" fill="url(#bubble2)" opacity=".85" />
        <path d="M40 74c0-22 18-40 40-40h72c22 0 40 18 40 40v44c0 22-18 40-40 40h-30l-30 26 4-26h-16c-22 0-40-18-40-40Z" fill="url(#bubble)" />
        <circle cx="86" cy="96" r="9" fill="#fff" />
        <circle cx="116" cy="96" r="9" fill="#fff" />
        <circle cx="146" cy="96" r="9" fill="#fff" />
        <path d="M200 20c1 9 4 14 14 16-10 2-13 7-14 16-1-9-4-14-14-16 10-2 13-7 14-16Z" fill="#c4506b" opacity=".8" />
        <path d="M30 150c1 6 3 9 9 10-6 1-8 4-9 10-1-6-3-9-9-10 6-1 8-4 9-10Z" fill="#c4506b" opacity=".6" />
      </svg>
    </div>
  );
}
