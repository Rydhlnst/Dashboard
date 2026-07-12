"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import dynamic from "next/dynamic";
import type { CallBackProps, Step } from "react-joyride";
import { STATUS, EVENTS, ACTIONS } from "react-joyride";

// react-joyride uses DOM APIs — load client-side only
const Joyride = dynamic(() => import("react-joyride"), { ssr: false });

const LS_ENABLED_KEY   = "dashboardTour.enabled";
const LS_COMPLETED_KEY = "dashboardTour.completed";

const STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Selamat datang di Dashboard!",
    content:
      "Ikuti panduan singkat ini untuk mengenal cara mengelola dataset, import file, mengedit data, dan membuat chart. Bisa dilewati kapan saja.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-overview"]',
    title: "Overview",
    content: "Ringkasan seluruh dataset ada di sini.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="nav-dataset-group"]',
    title: "Dataset Anda",
    content:
      "Setiap dataset yang diaktifkan sidebar-nya akan tampil di grup ini. Klik salah satu untuk melihat data & chart-nya.",
    disableBeacon: true,
    placement: "right",
  },
  {
    target: '[data-tour="nav-import"]',
    title: "Import Data",
    content:
      "Upload file CSV atau Excel (termasuk export dari Google Drive/Sheets). Kolom & tipe data otomatis terdeteksi.",
    disableBeacon: true,
    placement: "right",
  },
  {
    target: '[data-tour="nav-datasets"]',
    title: "Kelola Dataset",
    content:
      "Aktifkan/matikan tampilan dataset di sidebar, atur label, hapus dataset, atau lakukan re-import dari sini.",
    disableBeacon: true,
    placement: "right",
  },
  {
    target: '[data-tour="dataset-tabs"]',
    title: "Data & Charts",
    content:
      "Di halaman dataset, ada 2 tab: Data (untuk melihat & edit baris) dan Charts (untuk membuat chart khusus dataset ini).",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="row-actions"]',
    title: "Edit / Hapus Baris",
    content:
      "Klik ikon pensil untuk edit baris (semua kolom bisa diubah), atau ikon tempat sampah untuk hapus baris.",
    disableBeacon: true,
    placement: "left",
  },
  {
    target: '[data-tour="tour-toggle"]',
    title: "Ulangi Kapan Saja",
    content:
      "Ingin melihat tutorial lagi? Klik tombol ini. Toggle di dropdown-nya juga bisa mengaktifkan/mematikan tour otomatis.",
    disableBeacon: true,
    placement: "bottom-end",
  },
];

// ─── Context ─────────────────────────────────────────────────────────────────

interface TourContextValue {
  enabled: boolean;
  running: boolean;
  setEnabled: (v: boolean) => void;
  start: () => void;
  stop: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within <DashboardTourProvider>");
  return ctx;
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function DashboardTourProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [running, setRunning]      = useState(false);
  const [stepIndex, setStepIndex]  = useState(0);
  const [mounted, setMounted]      = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedEnabled = localStorage.getItem(LS_ENABLED_KEY);
      const isEnabled    = savedEnabled === null ? true : savedEnabled === "1";
      setEnabledState(isEnabled);

      const completed = localStorage.getItem(LS_COMPLETED_KEY) === "1";
      if (isEnabled && !completed) {
        // Small delay to let the sidebar/topbar render before targeting them
        setTimeout(() => { setStepIndex(0); setRunning(true); }, 800);
      }
    } catch { /* noop */ }
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    try { localStorage.setItem(LS_ENABLED_KEY, v ? "1" : "0"); } catch {}
    if (!v) setRunning(false);
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setRunning(true);
    try { localStorage.removeItem(LS_COMPLETED_KEY); } catch {}
  }, []);

  const stop = useCallback(() => setRunning(false), []);

  const handleCallback = useCallback((data: CallBackProps) => {
    const { status, type, index, action } = data;

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      const nextIndex = index + (action === ACTIONS.PREV ? -1 : 1);
      if (nextIndex < 0 || nextIndex >= STEPS.length) {
        setRunning(false);
        try { localStorage.setItem(LS_COMPLETED_KEY, "1"); } catch {}
      } else {
        setStepIndex(nextIndex);
      }
    } else if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunning(false);
      try { localStorage.setItem(LS_COMPLETED_KEY, "1"); } catch {}
    }
  }, []);

  return (
    <TourContext.Provider value={{ enabled, running, setEnabled, start, stop }}>
      {children}
      {mounted && (
        <Joyride
          steps={STEPS}
          run={running}
          stepIndex={stepIndex}
          continuous
          showProgress
          showSkipButton
          disableScrolling={false}
          scrollToFirstStep
          spotlightClicks
          callback={handleCallback}
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
              primaryColor: "#14b8a6",   // teal-500 to match app accent
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
    </TourContext.Provider>
  );
}
