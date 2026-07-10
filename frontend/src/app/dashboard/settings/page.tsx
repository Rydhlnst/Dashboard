"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { settingsApi } from "@/lib/api";
import { Setting } from "@/types/column";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Settings, Save } from "lucide-react";

const SETTING_LABELS: Record<string, { label: string; description: string; type: "toggle" | "text" }> = {
  completed_uses_flag: {
    label: "Completed: use progress_done_flag = 1",
    description: "If enabled, a record is considered Completed when progress_done_flag = '1'.",
    type: "toggle",
  },
  completed_uses_rfs: {
    label: "Completed: use RFS Actual date",
    description: "If enabled, a record is considered Completed when RFS Actual has a valid date.",
    type: "toggle",
  },
  dropped_uses_status_po: {
    label: "Dropped: use Status PO = Drop",
    description: "If enabled, records with Status PO = 'Drop' are considered Dropped.",
    type: "toggle",
  },
  dropped_uses_flag_x: {
    label: "Dropped: use progress_done_flag = x",
    description: "If enabled, records with progress_done_flag = 'x' are considered Dropped.",
    type: "toggle",
  },
  issue_check_pic_blocking: {
    label: "Issue: check PIC Blocking",
    description: "Count non-empty PIC Blocking as an issue.",
    type: "toggle",
  },
  issue_check_acceptance_blocking: {
    label: "Issue: check Acceptance Blocking fields",
    description: "Count non-empty ATP/LV/OAC/QC/SQAC/BAUT/BAST Blocking as an issue.",
    type: "toggle",
  },
  issue_exclude_category: {
    label: "Issue Exclude Category",
    description: "Records with this Issue Category value are NOT counted as issues (e.g. already RFS).",
    type: "text",
  },
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.list().then((res) => {
      if (res.success && res.data) {
        const map: Record<string, string> = {};
        (res.data as Setting[]).forEach((s) => { map[s.setting_key] = s.setting_value ?? ""; });
        setSettings(map);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
      const res = await settingsApi.update(updates);
      if (res.success) {
        toast.success("Settings saved.");
      } else {
        toast.error(res.message || "Save failed.");
      }
    } finally { setSaving(false); }
  };

  const setVal = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <AppLayout title="Settings" adminOnly>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={18} className="text-teal-500" />
          <div>
            <p className="text-sm font-semibold">Dashboard Settings</p>
            <p className="text-xs text-muted-foreground">Configure progress logic and dashboard behavior</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Loading…</div>
        ) : (
          <>
            <div className="space-y-4">
              {Object.entries(SETTING_LABELS).map(([key, meta]) => (
                <div key={key} className="bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{meta.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
                  </div>
                  <div className="shrink-0">
                    {meta.type === "toggle" ? (
                      <button
                        onClick={() => setVal(key, settings[key] === "1" ? "0" : "1")}
                        className={`w-10 h-5 rounded-full transition-colors ${settings[key] === "1" ? "bg-teal-500" : "bg-muted"}`}
                      >
                        <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${settings[key] === "1" ? "translate-x-5" : "translate-x-0"}`} />
                      </button>
                    ) : (
                      <Input
                        value={settings[key] ?? ""}
                        onChange={(e) => setVal(key, e.target.value)}
                        className="h-8 text-xs w-48"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-5">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Save size={14} />
                {saving ? "Saving…" : "Save Settings"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
