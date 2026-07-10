"use client";

import {
  useState, useCallback, useMemo, useRef, memo,
} from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { importApi } from "@/lib/api";
import { DatasetType } from "@/types/project";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, CheckCircle2, AlertTriangle, XCircle, ChevronRight,
  RotateCcw, Download, FileSpreadsheet, Loader2, ChevronDown,
  ChevronUp, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;
type RowStatus = "valid" | "warning" | "error" | "pending" | "imported";
type ColAction = "create" | "map" | "ignore";

interface UnknownCol {
  header: string;
  field_key: string;
  in_col_defs: boolean;
  col_def_id: number | null;
}

interface UploadResult {
  batch_id: number;
  file_name: string;
  dataset_type: string;
  total_rows: number;
  column_map: Record<string, string>;
  unknown_columns: Record<string, UnknownCol>;
  known_count: number;
  unknown_count: number;
  preview_rows: Record<string, string>[];
}

interface ValidationSummary {
  batch_id: number;
  total: number;
  valid: number;
  warning: number;
  error: number;
}

interface StagingRow {
  id: number;
  row_number: number;
  status: RowStatus;
  pdid: string | null;
  site_name: string | null;
  status_po: string | null;
  error_count: number;
  warning_count: number;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

interface StagingMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

interface ConfirmResult {
  batch_id: number;
  inserted: number;
  updated: number;
  skipped: number;
  total_imported: number;
  include_warnings: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DATASETS: { value: DatasetType; label: string }[] = [
  { value: "closing",    label: "Closing Progress" },
  { value: "filter900",  label: "Filter 900" },
  { value: "refinement", label: "Refinement / Combat" },
];

const STEP_LABELS = ["Dataset & File", "Column Mapping", "Validating", "Review", "Done"];

const STATUS_BADGE_CLS: Record<RowStatus, string> = {
  valid:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending:  "bg-muted/60 text-muted-foreground",
  imported: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const STATUS_LABEL: Record<RowStatus, string> = {
  valid: "Valid", warning: "Warning", error: "Error", pending: "Pending", imported: "Imported",
};

// ─── Step bar ────────────────────────────────────────────────────────────────

const StepBar = memo(({ current }: { current: Step }) => (
  <div className="flex items-center mb-8 select-none">
    {STEP_LABELS.map((label, i) => {
      const idx   = (i + 1) as Step;
      const done  = current > idx;
      const active = current === idx;
      return (
        <div key={idx} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <span className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 transition-colors",
              done   ? "bg-teal-500/15 text-teal-600 dark:text-teal-400" :
              active ? "bg-teal-600 text-white shadow-sm" :
                       "bg-muted text-muted-foreground/40"
            )}>
              {done ? "✓" : idx}
            </span>
            <span className={cn(
              "hidden sm:inline text-[11px] transition-colors",
              active ? "font-semibold text-foreground" : "text-muted-foreground/50"
            )}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={cn(
              "h-px mx-2.5 sm:mx-3 w-5 sm:w-8 shrink-0 transition-colors",
              current > idx ? "bg-teal-400" : "bg-border/50"
            )} />
          )}
        </div>
      );
    })}
  </div>
));
StepBar.displayName = "StepBar";

// ─── KPI card ────────────────────────────────────────────────────────────────

const KpiStat = memo(({ label, value, colorClass }: {
  label: string; value: number; colorClass: string;
}) => (
  <div className="rounded-2xl bg-card shadow-sm p-5 text-center">
    <p className={cn("text-3xl font-bold tabular-nums", colorClass)}>
      {value.toLocaleString()}
    </p>
    <p className="text-[11px] text-muted-foreground mt-1.5">{label}</p>
  </div>
));
KpiStat.displayName = "KpiStat";

// ─── Expandable row ───────────────────────────────────────────────────────────

const ExpandableRow = memo(({ row }: { row: StagingRow }) => {
  const [open, setOpen] = useState(false);
  const hasIssues = row.error_count > 0 || row.warning_count > 0;

  return (
    <>
      <tr className={cn(
        "border-t border-border/30 text-xs transition-colors",
        row.status === "error"   ? "bg-red-50/20 dark:bg-red-950/10" :
        row.status === "warning" ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
      )}>
        <td className="px-3 py-2.5 text-muted-foreground/50 tabular-nums w-12">{row.row_number}</td>
        <td className="px-3 py-2.5 w-20">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_BADGE_CLS[row.status])}>
            {STATUS_LABEL[row.status]}
          </span>
        </td>
        <td className="px-3 py-2.5 font-mono text-[11px]">{row.pdid ?? "—"}</td>
        <td className="px-3 py-2.5 max-w-[9rem] truncate text-muted-foreground">{row.site_name ?? "—"}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{row.status_po ?? "—"}</td>
        <td className="px-3 py-2.5">
          {row.error_count > 0 && <span className="text-red-500 font-medium">{row.error_count} err</span>}
          {row.error_count > 0 && row.warning_count > 0 && <span className="mx-1 opacity-30">·</span>}
          {row.warning_count > 0 && <span className="text-amber-500 font-medium">{row.warning_count} warn</span>}
          {!hasIssues && <span className="text-teal-500">✓</span>}
        </td>
        <td className="px-3 py-2.5 w-7">
          {hasIssues && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </td>
      </tr>
      {open && hasIssues && (
        <tr className="border-t border-border/20">
          <td colSpan={7} className="px-5 py-2.5 bg-muted/20">
            <div className="space-y-1">
              {row.errors.map((e, i) => (
                <p key={i} className="text-[10px] text-red-600 dark:text-red-400 leading-relaxed">
                  <span className="font-mono font-semibold opacity-70">[{e.field}]</span>{" "}{e.message}
                </p>
              ))}
              {row.warnings.map((w, i) => (
                <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400 leading-relaxed">
                  <span className="font-mono font-semibold opacity-70">[{w.field}]</span>{" "}{w.message}
                </p>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});
ExpandableRow.displayName = "ExpandableRow";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportPage() {
  const [step, setStep]                 = useState<Step>(1);
  const [dataset, setDataset]           = useState<DatasetType>("closing");
  const [file, setFile]                 = useState<File | null>(null);
  const [dragOver, setDragOver]         = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [colActions, setColActions]     = useState<Record<string, { action: ColAction; field_key: string }>>({});
  const [summary, setSummary]           = useState<ValidationSummary | null>(null);
  const [stagingRows, setStagingRows]   = useState<StagingRow[]>([]);
  const [stagingMeta, setStagingMeta]   = useState<StagingMeta | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all"|"valid"|"warning"|"error">("all");
  const [loadingRows, setLoadingRows]   = useState(false);
  const [importing, setImporting]       = useState(false);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["xlsx","xls","csv"].includes(ext)) {
      toast.error("Only .xlsx, .xls, .csv files are supported."); return;
    }
    setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await importApi.upload(file, dataset);
      if (res.success) {
        setUploadResult(res.data as UploadResult);
        const defaults: typeof colActions = {};
        Object.entries(res.data.unknown_columns as Record<string, UnknownCol>).forEach(
          ([letter, info]) => {
            defaults[letter] = { action: info.in_col_defs ? "map" : "create", field_key: info.field_key };
          }
        );
        setColActions(defaults);
        setStep(2);
      } else {
        toast.error(res.message || "Upload failed.");
      }
    } catch {
      toast.error("Upload failed — check file and try again.");
    } finally {
      setUploading(false);
    }
  }, [file, dataset]);

  const loadStagingRows = useCallback(async (
    batchId: number, page: number, status: typeof statusFilter
  ) => {
    setLoadingRows(true);
    try {
      const res = await importApi.getStaging(batchId, page, 50, status);
      if (res.success) {
        const d = res.data as { rows: StagingRow[]; meta: StagingMeta };
        setStagingRows(d.rows);
        setStagingMeta(d.meta);
      }
    } catch {
      toast.error("Failed to load rows.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  const handleValidate = useCallback(async () => {
    if (!uploadResult) return;
    setStep(3);
    try {
      const res = await importApi.validate(uploadResult.batch_id, colActions);
      if (res.success) {
        setSummary(res.data as ValidationSummary);
        await loadStagingRows(uploadResult.batch_id, 1, "all");
        setStep(4);
      } else {
        toast.error(res.message || "Validation failed.");
        setStep(2);
      }
    } catch {
      toast.error("Validation failed.");
      setStep(2);
    }
  }, [uploadResult, colActions, loadStagingRows]);

  const handleFilterChange = useCallback((f: typeof statusFilter) => {
    if (!uploadResult) return;
    setStatusFilter(f);
    loadStagingRows(uploadResult.batch_id, 1, f);
  }, [uploadResult, loadStagingRows]);

  const handlePageChange = useCallback((p: number) => {
    if (!uploadResult) return;
    loadStagingRows(uploadResult.batch_id, p, statusFilter);
  }, [uploadResult, statusFilter, loadStagingRows]);

  const handleConfirm = useCallback(async (includeWarnings: boolean) => {
    if (!uploadResult) return;
    setImporting(true);
    try {
      const res = await importApi.confirm(uploadResult.batch_id, includeWarnings);
      if (res.success) {
        setConfirmResult(res.data as ConfirmResult);
        setStep(5);
        toast.success(`Import complete — ${(res.data as ConfirmResult).total_imported} records saved.`);
      } else {
        toast.error(res.message || "Import failed.");
      }
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }, [uploadResult]);

  const handleDiscard = useCallback(async () => {
    if (uploadResult?.batch_id) {
      try { await importApi.discard(uploadResult.batch_id); } catch {}
    }
    setStep(1); setFile(null); setUploadResult(null); setColActions({});
    setSummary(null); setStagingRows([]); setStagingMeta(null);
    setStatusFilter("all"); setConfirmResult(null);
  }, [uploadResult]);

  const canImport   = (summary?.valid ?? 0) > 0;
  const hasWarnings = (summary?.warning ?? 0) > 0;
  const hasErrors   = (summary?.error ?? 0) > 0;
  const unknownEntries = useMemo(
    () => Object.entries(uploadResult?.unknown_columns ?? {}),
    [uploadResult]
  );

  return (
    <AppLayout title="Import Data" adminOnly>
      <div className="max-w-3xl mx-auto">
        <StepBar current={step} />

        {/* ── Step 1: Dataset & File ── */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold">Dataset & File</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select dataset type, then upload your Excel or CSV.
              </p>
            </div>

            <div className="max-w-xs">
              <p className="text-xs text-muted-foreground mb-1.5">Dataset Type</p>
              <Select value={dataset} onValueChange={(v) => setDataset(v as DatasetType)}>
                <SelectTrigger className="h-9 text-sm bg-card shadow-sm border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASETS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                handleFile(e.dataTransfer.files[0] ?? null);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center h-40 rounded-2xl cursor-pointer transition-all",
                dragOver
                  ? "bg-teal-50 dark:bg-teal-950/20 ring-2 ring-teal-400/60 ring-offset-2"
                  : file
                    ? "bg-teal-50/40 dark:bg-teal-950/10 ring-1 ring-teal-300/40"
                    : "bg-muted/30 hover:bg-muted/50 dark:bg-muted/20"
              )}
            >
              <FileSpreadsheet size={26} className={file ? "text-teal-500" : "text-muted-foreground/30"} />
              <p className={cn(
                "text-sm mt-2.5 font-medium",
                file ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground/60"
              )}>
                {file ? file.name : "Drop file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground/40 mt-1">
                {file ? `${(file.size / 1024).toFixed(1)} KB` : ".xlsx · .xls · .csv"}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                className="sr-only"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {file && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground/60">
                <Info size={11} className="mt-0.5 shrink-0" />
                Data goes into a staging area first — nothing in the database changes until you confirm.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm"
                disabled={!file || uploading}
                onClick={handleUpload}
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Uploading…" : "Upload & Analyse"}
              </Button>
              {file && (
                <Button variant="ghost" size="sm" className="text-muted-foreground/60" onClick={() => setFile(null)}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Column Mapping ── */}
        {step === 2 && uploadResult && (
          <div className="space-y-4">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold">Column Mapping</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {uploadResult.file_name} · {uploadResult.total_rows.toLocaleString()} rows
                </p>
              </div>
              <div className="flex gap-1.5">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                  {uploadResult.known_count} matched
                </span>
                {uploadResult.unknown_count > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {uploadResult.unknown_count} unknown
                  </span>
                )}
              </div>
            </div>

            {/* Matched columns */}
            <div className="bg-card rounded-2xl shadow-sm p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-3">
                Matched columns
              </p>
              {uploadResult.known_count === 0 ? (
                <p className="text-xs text-red-500">No columns recognised — check file headers.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(uploadResult.column_map).map(([header, dbCol]) => (
                    <span key={header} className="inline-flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded-full bg-muted/40 font-mono">
                      <span className="text-muted-foreground">{header}</span>
                      <span className="opacity-30">→</span>
                      <span className="text-teal-600 dark:text-teal-400">{dbCol}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Unknown columns */}
            {unknownEntries.length > 0 && (
              <div className="bg-card rounded-2xl shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-3">
                  Unknown columns — choose action
                </p>
                <div className="space-y-3">
                  {unknownEntries.map(([letter, info]) => (
                    <div key={letter} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{info.header}</p>
                        <p className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">{info.field_key}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Select
                          value={colActions[letter]?.action ?? "ignore"}
                          onValueChange={(v) =>
                            setColActions((prev) => ({
                              ...prev, [letter]: { ...prev[letter], action: v as ColAction },
                            }))
                          }
                        >
                          <SelectTrigger className="h-7 text-[11px] w-44 bg-card border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Create dynamic column</SelectItem>
                            <SelectItem value="map">Map to existing field</SelectItem>
                            <SelectItem value="ignore">Ignore</SelectItem>
                          </SelectContent>
                        </Select>
                        {info.in_col_defs && (
                          <span className="text-[10px] text-teal-500 font-medium">In DB</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            {uploadResult.preview_rows.length > 0 && (
              <div className="bg-card rounded-2xl shadow-sm p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/50 mb-3">
                  Preview · first {uploadResult.preview_rows.length} rows
                </p>
                <div className="overflow-auto">
                  <table className="text-[10px] w-full">
                    <thead>
                      <tr>
                        {Object.keys(uploadResult.preview_rows[0]).slice(0, 10).map((k) => (
                          <th key={k} className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground/50 bg-muted/20 border-b border-border/30 whitespace-nowrap">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {uploadResult.preview_rows.map((row, i) => (
                        <tr key={i} className={cn(i % 2 === 1 && "bg-muted/10")}>
                          {Object.values(row).slice(0, 10).map((v, j) => (
                            <td key={j} className="px-2.5 py-1.5 border-b border-border/20 whitespace-nowrap max-w-[8rem] truncate">
                              {String(v ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleDiscard} className="gap-1 text-muted-foreground/60">
                <RotateCcw size={11} /> Back
              </Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
                disabled={uploadResult.known_count === 0}
                onClick={handleValidate}
              >
                Run Validation <ChevronRight size={13} />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Validating ── */}
        {step === 3 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-teal-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Validating {uploadResult?.total_rows?.toLocaleString()} rows</p>
              <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-xs">
                Mapping columns, cleaning data, checking required fields and duplicates.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 4: Review ── */}
        {step === 4 && summary && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiStat label="Total Rows"  value={summary.total}   colorClass="text-foreground" />
              <KpiStat label="Valid"        value={summary.valid}   colorClass="text-teal-500" />
              <KpiStat label="Warning"      value={summary.warning} colorClass="text-amber-500" />
              <KpiStat label="Error"        value={summary.error}   colorClass="text-red-500" />
            </div>

            {/* Status messages */}
            <div className="space-y-1.5">
              {summary.error === 0 && summary.warning === 0 && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-teal-50/50 dark:bg-teal-950/20 text-xs text-teal-700 dark:text-teal-300">
                  <CheckCircle2 size={13} /> All rows are valid — ready to import.
                </div>
              )}
              {hasErrors && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-300">
                  <XCircle size={13} />
                  {summary.error} row{summary.error !== 1 ? "s" : ""} with errors will be skipped.
                  Download the error report to fix and re-import.
                </div>
              )}
              {hasWarnings && (
                <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle size={13} />
                  {summary.warning} row{summary.warning !== 1 ? "s" : ""} with warnings (will update existing records).
                  You can include them.
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 shadow-sm"
                disabled={!canImport || importing}
                onClick={() => handleConfirm(false)}
              >
                {importing
                  ? <Loader2 size={13} className="animate-spin" />
                  : <CheckCircle2 size={13} />
                }
                Import Valid Only ({summary.valid})
              </Button>
              {hasWarnings && (
                <Button
                  variant="outline"
                  className="gap-1.5 border-amber-300/70 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20 dark:border-amber-700/50"
                  disabled={importing}
                  onClick={() => handleConfirm(true)}
                >
                  <AlertTriangle size={13} />
                  + Warnings ({summary.valid + summary.warning})
                </Button>
              )}
              <a
                href={importApi.downloadErrorsUrl(uploadResult!.batch_id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <Download size={13} /> Error Report
              </a>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                className="ml-auto text-muted-foreground/50 hover:text-muted-foreground gap-1"
              >
                <RotateCcw size={11} /> Discard
              </Button>
            </div>

            {/* Staging table */}
            <div className="bg-card rounded-2xl shadow-sm overflow-hidden">
              {/* Filter tabs */}
              <div className="flex items-center border-b border-border/30 px-2 pt-0.5">
                {(["all","valid","warning","error"] as const).map((f) => {
                  const count =
                    f === "all"     ? summary.total :
                    f === "valid"   ? summary.valid :
                    f === "warning" ? summary.warning : summary.error;
                  return (
                    <button
                      key={f}
                      onClick={() => handleFilterChange(f)}
                      className={cn(
                        "px-3 py-2.5 text-[11px] font-medium border-b-2 transition-colors capitalize whitespace-nowrap",
                        statusFilter === f
                          ? "border-teal-500 text-teal-600 dark:text-teal-400"
                          : "border-transparent text-muted-foreground/50 hover:text-foreground"
                      )}
                    >
                      {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                      <span className="ml-1 opacity-60">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/20">
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50 w-12">#</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50 w-20">Status</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50">PDID</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50">Site</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50">Status PO</th>
                      <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground/50">Issues</th>
                      <th className="px-3 py-2.5 w-7" />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingRows
                      ? Array.from({ length: 7 }).map((_, i) => (
                          <tr key={i} className="border-t border-border/20">
                            {Array.from({ length: 7 }).map((_, j) => (
                              <td key={j} className="px-3 py-3">
                                <div className="h-2.5 rounded-full bg-muted animate-pulse" style={{ width: `${30 + j * 9}%` }} />
                              </td>
                            ))}
                          </tr>
                        ))
                      : stagingRows.length === 0
                        ? (
                          <tr>
                            <td colSpan={7} className="py-10 text-center text-xs text-muted-foreground/50">
                              No rows match the filter.
                            </td>
                          </tr>
                        )
                        : stagingRows.map((row) => <ExpandableRow key={row.id} row={row} />)
                    }
                  </tbody>
                </table>
              </div>

              {stagingMeta && stagingMeta.total_pages > 1 && (
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30 text-[11px] text-muted-foreground/50">
                  <span className="tabular-nums">
                    {((stagingMeta.page - 1) * stagingMeta.limit) + 1}–
                    {Math.min(stagingMeta.page * stagingMeta.limit, stagingMeta.total)} of {stagingMeta.total.toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-[13px]"
                      disabled={stagingMeta.page <= 1 || loadingRows}
                      onClick={() => handlePageChange(stagingMeta.page - 1)}
                    >‹</Button>
                    <span className="px-2 tabular-nums">{stagingMeta.page} / {stagingMeta.total_pages}</span>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0 text-[13px]"
                      disabled={stagingMeta.page >= stagingMeta.total_pages || loadingRows}
                      onClick={() => handlePageChange(stagingMeta.page + 1)}
                    >›</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 5: Done ── */}
        {step === 5 && confirmResult && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/30 flex items-center justify-center mb-5">
              <CheckCircle2 size={26} className="text-teal-500" />
            </div>
            <p className="text-lg font-semibold">Import complete</p>
            <p className="text-xs text-muted-foreground/60 mt-1 mb-8">
              Batch #{confirmResult.batch_id} · {DATASETS.find((d) => d.value === uploadResult?.dataset_type)?.label}
            </p>

            <div className="grid grid-cols-3 gap-3 max-w-xs w-full mb-8">
              {[
                { label: "New records", value: confirmResult.inserted, cls: "text-teal-500" },
                { label: "Updated",     value: confirmResult.updated,  cls: "text-blue-500" },
                { label: "Skipped",     value: confirmResult.skipped,  cls: "text-muted-foreground" },
              ].map(({ label, value, cls }) => (
                <div key={label} className="rounded-2xl bg-card shadow-sm p-4">
                  <p className={cn("text-2xl font-bold tabular-nums", cls)}>{value}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1.5">{label}</p>
                </div>
              ))}
            </div>

            <Button
              onClick={handleDiscard}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2 shadow-sm"
            >
              <RotateCcw size={13} /> Import Another File
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
