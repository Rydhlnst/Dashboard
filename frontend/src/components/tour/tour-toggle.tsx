"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle, Play, Check } from "lucide-react";
import { useTour } from "./dashboard-tour";
import { cn } from "@/lib/utils";

export function TourToggle() {
  const { enabled, running, setEnabled, start, stop } = useTour();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref} data-tour="tour-toggle">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
          running && "text-teal-600 dark:text-teal-400"
        )}
        aria-label="Panduan"
        title="Panduan penggunaan"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-2">
          <div className="px-2 py-1.5">
            <p className="text-xs font-semibold">Panduan Dashboard</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tutorial singkat cara pakai dashboard.
            </p>
          </div>

          <button
            type="button"
            onClick={() => { setOpen(false); running ? stop() : start(); }}
            className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Play size={13} className="text-teal-500" />
            {running ? "Hentikan tour" : "Mulai tour sekarang"}
          </button>

          <div className="my-1 border-t border-border/60" />

          <button
            type="button"
            onClick={() => setEnabled(!enabled)}
            className="flex w-full items-center justify-between rounded-md px-2 py-2 text-xs text-foreground hover:bg-muted transition-colors"
          >
            <span className="flex items-center gap-2">
              <Check size={13} className={cn(enabled ? "text-teal-500" : "text-transparent")} />
              Tampilkan otomatis
            </span>
            <span
              className={cn(
                "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors",
                enabled ? "bg-teal-500" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
                  enabled ? "left-3.5" : "left-0.5"
                )}
              />
            </span>
          </button>
          <p className="px-2 pb-1 text-[10px] text-muted-foreground/70 leading-relaxed">
            Aktif: tour muncul otomatis untuk pengguna baru. Nonaktif: tour hanya muncul saat kamu klik &quot;Mulai tour&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
