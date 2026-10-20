"use client";

import * as React from "react";
import { Check } from "lucide-react";

/** A small toast. Returns the element to render and a function to show a message. */
export function useNotice() {
  const [message, setMessage] = React.useState("");
  const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = React.useCallback((text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 2200);
  }, []);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      {message && (
        <span className="rise-in inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
          <Check className="h-4 w-4" />
          {message}
        </span>
      )}
    </div>
  );
  return { show, node };
}
