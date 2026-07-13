"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { CallBackProps, Step } from "react-joyride";
import { STATUS } from "react-joyride";
import { Button } from "@/components/ui/button";
import { HelpCircle } from "lucide-react";

const Joyride = dynamic(
  () => import("react-joyride").then((mod) => ({ default: mod.Joyride })),
  { ssr: false }
);

interface PageTourProps {
  steps: Step[];
  storageKey: string;              // localStorage key — one per page tour
  autoStartDelayMs?: number;       // ms to wait for DOM before auto-run
  triggerLabel?: string;           // label for the replay button
  hideTrigger?: boolean;           // skip rendering the replay button
}

export function PageTour({
  steps,
  storageKey,
  autoStartDelayMs = 700,
  triggerLabel = "Panduan",
  hideTrigger = false,
}: PageTourProps) {
  const [mounted, setMounted]     = useState(false);
  const [running, setRunning]     = useState(false);
  const [runKey, setRunKey]       = useState(0);
  const [activeSteps, setActive]  = useState<Step[]>(steps);

  const resolveSteps = useCallback(() => {
    const filtered = steps.filter(s => {
      const t = s.target;
      if (typeof t !== "string" || t === "body") return true;
      return !!document.querySelector(t);
    });
    setActive(filtered.length ? filtered : steps.slice(0, 1));
  }, [steps]);

  useEffect(() => {
    setMounted(true);
    try {
      const done = localStorage.getItem(storageKey) === "1";
      if (!done) {
        const t = setTimeout(() => {
          resolveSteps();
          setRunKey(k => k + 1);
          setRunning(true);
        }, autoStartDelayMs);
        return () => clearTimeout(t);
      }
    } catch { /* noop */ }
  }, [storageKey, autoStartDelayMs, resolveSteps]);

  const replay = useCallback(() => {
    setRunning(false);
    try { localStorage.removeItem(storageKey); } catch {}
    resolveSteps();
    setRunKey(k => k + 1);
    setTimeout(() => setRunning(true), 50);
  }, [storageKey, resolveSteps]);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, action } = data as CallBackProps & { type?: string; action?: string };
    const done =
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      type === "tour:end" ||
      action === "close" ||
      action === "skip" ||
      action === "reset";
    if (done) {
      setRunning(false);
      try { localStorage.setItem(storageKey, "1"); } catch {}
    }
  }, [storageKey]);

  return (
    <>
      {!hideTrigger && (
        <Button
          size="sm"
          variant="ghost"
          onClick={replay}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <HelpCircle size={13} />
          {triggerLabel}
        </Button>
      )}
      {mounted && (
        <Joyride
          key={runKey}
          steps={activeSteps}
          run={running}
          continuous
          showProgress
          showSkipButton
          disableScrolling={false}
          scrollToFirstStep
          spotlightClicks
          onEvent={handleCallback as unknown as (data: CallBackProps) => void}
          locale={{
            back: "Kembali",
            close: "Tutup",
            last: "Selesai",
            next: "Lanjut",
            skip: "Lewati",
          }}
          styles={{
            options: {
              zIndex: 10000,
              primaryColor: "#14b8a6",
              textColor: "#0f172a",
              backgroundColor: "#ffffff",
              arrowColor: "#ffffff",
              overlayColor: "rgba(0, 0, 0, 0.55)",
            },
            tooltip: { borderRadius: 12, padding: 16 },
            tooltipTitle: { fontSize: 14, fontWeight: 700 },
            tooltipContent: { fontSize: 13, lineHeight: 1.5, padding: "8px 0" },
            buttonNext: { borderRadius: 8, fontSize: 12, padding: "8px 14px" },
            buttonBack: { fontSize: 12 },
            buttonSkip: { fontSize: 12 },
          }}
        />
      )}
    </>
  );
}
