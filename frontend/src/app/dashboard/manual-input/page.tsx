"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { columnsApi, projectApi } from "@/lib/api";
import { ColumnDefinition } from "@/types/column";
import { DatasetType } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PenLine, RotateCcw, Save } from "lucide-react";

const DATASETS: { value: DatasetType; label: string }[] = [
  { value: "closing", label: "Closing" },
  { value: "filter900", label: "Filter 900" },
  { value: "refinement", label: "Refinement / Combat" },
];

function FieldInput({
  col,
  value,
  onChange,
}: {
  col: ColumnDefinition;
  value: string;
  onChange: (v: string) => void;
}) {
  const cls = "h-8 text-xs";

  if (col.field_type === "select" && col.options_json) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cls}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {col.options_json.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col.field_type === "boolean") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={cls}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">Yes</SelectItem>
          <SelectItem value="0">No</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (col.field_type === "textarea") {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="flex w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
      />
    );
  }

  const inputType =
    col.field_type === "date" ? "date"
    : col.field_type === "datetime" ? "datetime-local"
    : col.field_type === "number" || col.field_type === "decimal" || col.field_type === "percentage" ? "number"
    : col.field_type === "url" ? "url"
    : "text";

  return (
    <Input
      type={inputType}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cls}
      placeholder={col.default_value ?? ""}
    />
  );
}

export default function ManualInputPage() {
  const [dataset, setDataset] = useState<DatasetType>("closing");
  const [columns, setColumns] = useState<ColumnDefinition[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    setValues({});
    columnsApi.list(dataset).then((res) => {
      if (res.success && res.data) {
        const cols = (res.data as ColumnDefinition[]).filter((c) => c.is_visible);
        setColumns(cols);
        // Init defaults
        const defaults: Record<string, string> = {};
        cols.forEach((c) => { if (c.default_value) defaults[c.field_key] = c.default_value; });
        setValues(defaults);
      }
    }).finally(() => setLoading(false));
  }, [dataset]);

  const reset = () => {
    const defaults: Record<string, string> = {};
    columns.forEach((c) => { if (c.default_value) defaults[c.field_key] = c.default_value; });
    setValues(defaults);
  };

  const handleSave = async () => {
    // Required validation
    const missing = columns.filter((c) => c.is_required && !values[c.field_key]);
    if (missing.length > 0) {
      toast.error(`Required fields missing: ${missing.map((c) => c.label).join(", ")}`);
      return;
    }

    setSaving(true);
    try {
      // Separate known DB cols from custom_fields
      const SYSTEM_KEYS = new Set([
        "pdid","po_year","caid","scarlett_ioms_id_before","scarlett_ioms_id_final",
        "status_po","pono_tsel","capex","band","sector","project_category","sow_actual",
        "vendor_principle","siteid_po","siteid_act","neid_act","site_name","infra_type",
        "lat","lng","city","province","nop","tp_detail","progress_done_flag","rfs_actual",
        "rfs_month","mitra_impl","progress_act","issue_category","notes_progress","gap_analysis",
        "blocking","support_needed","pic_blocking","detail_pic_blocking","gap_closing",
        "current_position","status_project","progress_closing","sub_progress_closing",
        "atp_status","lv_status","oac_status","qc_status","sqac_status","baut_status","bast_status",
        "atp_blocking","lv_blocking","oac_blocking","qc_blocking","sqac_blocking","baut_blocking","bast_blocking",
        "atp_approved","elv_approved","oac_approved","qc_sign","sqac_approved","baut_approved","bast_approved",
        "price_po","price_po_to_be_claim","price_bast","remaining_po","price_po_presales",
        "wbs_level3","network_number","cid1","cid2","remarks_sow","replan_rfs","plan_po","released_po",
      ]);

      const payload: Record<string, unknown> = { dataset_type: dataset };
      const customFields: Record<string, string> = {};

      for (const [key, val] of Object.entries(values)) {
        if (val === "") continue;
        if (SYSTEM_KEYS.has(key)) {
          payload[key] = val;
        } else {
          customFields[key] = val;
        }
      }
      if (Object.keys(customFields).length > 0) payload.custom_fields = customFields;

      const res = await projectApi.create(payload);
      if (res.success) {
        toast.success("Data saved successfully.");
        reset();
      } else {
        toast.error(res.message || "Save failed.");
      }
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Group columns by column_group
  const grouped: Record<string, ColumnDefinition[]> = {};
  columns.forEach((c) => {
    const g = c.column_group ?? "Other";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(c);
  });

  return (
    <AppLayout title="Input Manual" adminOnly>
      <div className="max-w-4xl mx-auto">
        {/* Dataset selector */}
        <div className="bg-card rounded-xl border border-border p-4 mb-5">
          <div className="flex items-center gap-3">
            <PenLine size={18} className="text-teal-500" />
            <div>
              <p className="text-sm font-semibold">Input Manual Data</p>
              <p className="text-xs text-muted-foreground">Form fields auto-adjust based on selected dataset</p>
            </div>
          </div>
          <div className="mt-3 max-w-xs">
            <Label className="text-xs">Select Dataset</Label>
            <Select value={dataset} onValueChange={(v) => setDataset(v as DatasetType)}>
              <SelectTrigger className="h-8 text-xs mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATASETS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Loading fields…
          </div>
        ) : (
          <>
            {Object.entries(grouped).map(([group, cols]) => (
              <div key={group} className="bg-card rounded-xl border border-border p-4 mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 capitalize">
                  {group}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cols.map((col) => (
                    <div key={col.field_key}>
                      <Label className="text-xs">
                        {col.label}
                        {col.is_required && <span className="text-red-500 ml-0.5">*</span>}
                      </Label>
                      <div className="mt-1">
                        <FieldInput
                          col={col}
                          value={values[col.field_key] ?? ""}
                          onChange={(v) => setValues((prev) => ({ ...prev, [col.field_key]: v }))}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw size={13} /> Reset
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Save size={13} />
                {saving ? "Saving…" : "Save Data"}
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
