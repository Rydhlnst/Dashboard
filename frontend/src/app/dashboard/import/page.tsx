"use client";

import { useState, useCallback, useRef, memo } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { importApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Upload, CheckCircle2, XCircle, RotateCcw,
  FileSpreadsheet, Loader2, ChevronDown, ChevronUp, DatabaseZap,
  ArrowRight, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5;
type RowStatus = "valid" | "warning" | "error" | "pending" | "imported";

interface ColDef { col_name: string; col_type: string; label: string }

interface UploadResult {
  batch_id: number;
  file_name: string;
  dataset_id: number;
  dataset_name: string;
  is_new_dataset: boolean;
  total_rows: number;
  columns: ColDef[];
  new_columns: ColDef[];
  preview_rows: Record<string, string>[];
}

interface ValidationSummary {
  batch_id: number;
  dataset_id: number;
  total: number;
  valid: number;
  warning: number;
  error: number;
}

interface StagingRow {
  id: number;
  row_number: number;
  status: RowStatus;
  preview_values: Record<string, string | null>;
  error_count: number;
  warning_count: number;
  errors: Array<{ field: string; message: string }>;
  warnings: Array<{ field: string; message: string }>;
}

interface StagingMeta { total: number; page: number; limit: number; total_pages: number }
interface PreviewCol { col_name: string; label: string }

interface ConfirmResult {
  batch_id: number;
  dataset_id: number;
  inserted: number;
  updated: number;
  skipped: number;
  total_imported: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Dataset & File", "Column Preview", "Validating", "Review", "Done"];

const STATUS_BADGE: Record<RowStatus, string> = {
  valid:    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  warning:  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  error:    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  pending:  "bg-muted/60 text-muted-foreground",
  imported: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};

const TYPE_BADGE: Record<string, string> = {
  "DATE":             "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  "DECIMAL(18,4)":    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "SMALLINT UNSIGNED":"bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  "TEXT":             "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  "VARCHAR(255)":     "bg-muted/60 text-muted-foreground",
  "VARCHAR(500)":     "bg-muted/60 text-muted-foreground",
};

// ─── Step bar ─────────────────────────────────────────────────────────────────

const StepBar = memo(({ current }: { current: Step }) => (
  <div className="flex items-center mb-8 select-none">
    {STEP_LABELS.map((label, i) => {
      const idx = (i + 1) as Step;
      const done = current > idx;
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

const KpiStat = memo(({ label, value, colorClass }: {
  label: string; value: number; colorClass: string;
}) => (
  <div className="rounded-2xl bg-card shadow-sm p-5 text-center">
    <p className={cn("text-3xl font-bold tabular-nums", colorClass)}>{value.toLocaleString()}</p>
    <p className="text-[11px] text-muted-foreground mt-1.5">{label}</p>
  </div>
));
KpiStat.displayName = "KpiStat";

const ExpandableRow = memo(({ row, previewCols }: { row: StagingRow; previewCols: PreviewCol[] }) => {
  const [open, setOpen] = useState(false);
  const hasIssues = row.error_count > 0 || row.warning_count > 0;
  const preview = previewCols.slice(0, 2);

  return (
    <>
      <tr className={cn(
        "border-t border-border/30 text-xs transition-colors",
        row.status === "error"   ? "bg-red-50/20 dark:bg-red-950/10" :
        row.status === "warning" ? "bg-amber-50/20 dark:bg-amber-950/10" : ""
      )}>
        <td className="px-3 py-2.5 text-muted-foreground/50 tabular-nums w-12">{row.row_number}</td>
        <td className="px-3 py-2.5 w-20">
          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold", STATUS_BADGE[row.status])}>
            {row.status}
          </span>
        </td>
        {preview.map(pc => (
          <td key={pc.col_name} className="px-3 py-2.5 max-w-[10rem] truncate text-muted-foreground">
            {row.preview_values[pc.col_name] ?? "—"}
          </td>
        ))}
        <td className="px-3 py-2.5">
          {row.error_count > 0 && <span className="text-red-500 font-medium">{row.error_count} err</span>}
          {row.error_count > 0 && row.warning_count > 0 && <span className="mx-1 opacity-30">·</span>}
          {row.warning_count > 0 && <span className="text-amber-500 font-medium">{row.warning_count} warn</span>}
          {!hasIssues && <span className="text-teal-500">✓</span>}
        </td>
        <td className="px-3 py-2.5 w-7">
          {hasIssues && (
            <button
              onClick={() => setOpen(o => !o)}
              className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </td>
      </tr>
      {open && hasIssues && (
        <tr className="border-t border-border/20">
          <td colSpan={5 + preview.length} className="px-5 py-2.5 bg-muted/20">
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
  const [step, setStep]                       = useState<Step>(1);
  const [datasetName, setDatasetName]         = useState("");
  const [primaryKeyCol, setPrimaryKeyCol]     = useState("");
  const [file, setFile]                       = useState<File | null>(null);
  const [dragOver, setDragOver]               = useState(false);
  const [uploading, setUploading]             = useState(false);
  const [uploadResult, setUploadResult]       = useState<UploadResult | null>(null);
  const [validating, setValidating]           = useState(false);
  const [summary, setSummary]                 = useState<ValidationSummary | null>(null);
  const [stagingRows, setStagingRows]         = useState<StagingRow[]>([]);
  const [stagingMeta, setStagingMeta]         = useState<StagingMeta | null>(null);
  const [previewCols, setPreviewCols]         = useState<PreviewCol[]>([]);
  const [statusFilter, setStatusFilter]       = useState<"all"|"valid"|"warning"|"error">("all");
  const [loadingRows, setLoadingRows]         = useState(false);
  const [importing, setImporting]             = useState(false);
  const [includeWarnings, setIncludeWarnings] = useState(true);
  const [confirmResult, setConfirmResult]     = useState<ConfirmResult | null>(null);
  const [stagingPage, setStagingPage]         = useState(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["xlsx","xls","csv"].includes(ext)) {
      toast.error("Only .xlsx, .xls, .csv files are supported.");
      return;
    }
    setFile(f);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file || !datasetName.trim()) return;
    setUploading(true);
    try {
      const res = await importApi.upload(
        file,
        datasetName.trim(),
        undefined,
        primaryKeyCol.trim() || undefined
      );
      if (res.success) {
        setUploadResult(res.data as UploadResult);
        setStep(2);
      } else {
        toast.error(res.message || "Upload failed.");
      }
    } catch {
      toast.error("Upload failed — check file and try again.");
    } finally {
      setUploading(false);
    }
  }, [file, datasetName, primaryKeyCol]);

  const loadStagingRows = useCallback(async (
    batchId: number, page: number, status: typeof statusFilter
  ) => {
    setLoadingRows(true);
    try {
      const res = await importApi.getStaging(batchId, page, 50, status);
      if (res.success) {
        const d = res.data as { rows: StagingRow[]; meta: StagingMeta; preview_cols: PreviewCol[] };
        setStagingRows(d.rows);
        setStagingMeta(d.meta);
        if (d.preview_cols) setPreviewCols(d.preview_cols);
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
    setValidating(true);
    try {
      const res = await importApi.validate(uploadResult.batch_id);
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
    } finally {
      setValidating(false);
    }
  }, [uploadResult, loadStagingRows]);

  const handleConfirm = useCallback(async () => {
    if (!uploadResult || !summary) return;
    setImporting(true);
    try {
      const res = await importApi.confirm(uploadResult.batch_id, includeWarnings);
      if (res.success) {
        setConfirmResult(res.data as ConfirmResult);
        setStep(5);
      } else {
        toast.error(res.message || "Import failed.");
      }
    } catch {
      toast.error("Import failed.");
    } finally {
      setImporting(false);
    }
  }, [uploadResult, summary, includeWarnings]);

  const handleReset = useCallback(() => {
    setStep(1); setDatasetName(""); setPrimaryKeyCol(""); setFile(null);
    setUploadResult(null); setSummary(null); setStagingRows([]); setStagingMeta(null);
    setConfirmResult(null); setStatusFilter("all"); setStagingPage(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handlePageChange = useCallback(async (p: number) => {
    if (!uploadResult) return;
    setStagingPage(p);
    await loadStagingRows(uploadResult.batch_id, p, statusFilter);
  }, [uploadResult, statusFilter, loadStagingRows]);

  const handleFilterChange = useCallback(async (f: typeof statusFilter) => {
    if (!uploadResult) return;
    setStatusFilter(f);
    setStagingPage(1);
    await loadStagingRows(uploadResult.batch_id, 1, f);
  }, [uploadResult, loadStagingRows]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Import Data</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload any Excel or CSV file — schema is auto-detected and a dedicated table is created.
          </p>
        </div>

        <StepBar current={step} />

        {/* ── Step 1: Dataset & File ────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="dataset-name" className="text-sm font-medium">
                  Dataset Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dataset-name"
                  value={datasetName}
                  onChange={e => setDatasetName(e.target.value)}
                  placeholder="e.g. Closing Progress Q3 2026"
                  className="max-w-md"
                />
                <p className="text-[11px] text-muted-foreground">
                  A new table <code className="font-mono text-[10px]">ds_{datasetName ? datasetName.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"") : "..."}</code> will be created.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pk-col" className="text-sm font-medium">
                  Primary Key Column <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="pk-col"
                  value={primaryKeyCol}
                  onChange={e => setPrimaryKeyCol(e.target.value)}
                  placeholder="e.g. PDID or Site ID — used to detect duplicates on re-import"
                  className="max-w-md"
                />
                <p className="text-[11px] text-muted-foreground">
                  Leave blank to always insert new rows. Must match a column header in your file.
                </p>
              </div>
            </div>

            {/* File drop zone */}
            <div
              className={cn(
                "rounded-2xl border-2 border-dashed transition-colors p-10 text-center cursor-pointer",
                dragOver ? "border-teal-400 bg-teal-50/10" : "border-border hover:border-teal-400/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                handleFile(e.dataTransfer.files[0] ?? null);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={e => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet className="text-teal-500" size={36} />
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload size={36} className="opacity-40" />
                  <p className="text-sm font-medium">Drop file here or click to browse</p>
                  <p className="text-xs">.xlsx, .xls, .csv supported</p>
                </div>
              )}
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || !datasetName.trim() || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? <><Loader2 size={14} className="mr-2 animate-spin" /> Uploading…</> : <><ArrowRight size={14} className="mr-2" /> Upload & Detect Schema</>}
            </Button>
          </div>
        )}

        {/* ── Step 2: Column Preview ────────────────────────────────────────── */}
        {step === 2 && uploadResult && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <DatabaseZap size={18} className="text-teal-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm">{uploadResult.dataset_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {uploadResult.is_new_dataset ? "New dataset created" : "Existing dataset — re-import"} ·{" "}
                    {uploadResult.total_rows.toLocaleString()} rows · {uploadResult.columns.length} columns
                  </p>
                </div>
              </div>
              {uploadResult.new_columns.length > 0 && (
                <div className="rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-400 flex gap-2 items-start">
                  <Info size={12} className="shrink-0 mt-0.5" />
                  <span>
                    <strong>{uploadResult.new_columns.length}</strong> new column(s) found and added to the schema:{" "}
                    {uploadResult.new_columns.map(c => c.label).join(", ")}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                <p className="text-sm font-semibold">Detected Columns</p>
                <p className="text-xs text-muted-foreground">{uploadResult.columns.length} columns</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/20">
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Header in File</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Column Name (DB)</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Inferred Type</th>
                      <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.columns.map((col, i) => {
                      const sampleVal = uploadResult.preview_rows[0]?.[col.col_name] ?? "—";
                      const isNew = uploadResult.new_columns.some(nc => nc.col_name === col.col_name);
                      return (
                        <tr key={col.col_name} className={cn("border-t border-border/30", isNew && "bg-amber-50/20 dark:bg-amber-950/10")}>
                          <td className="px-4 py-2 text-muted-foreground/50 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-2 font-medium">{col.label} {isNew && <span className="ml-1 text-[9px] bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-semibold">NEW</span>}</td>
                          <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{col.col_name}</td>
                          <td className="px-4 py-2">
                            <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-semibold", TYPE_BADGE[col.col_type] ?? "bg-muted/60 text-muted-foreground")}>
                              {col.col_type}
                            </span>
                          </td>
                          <td className="px-4 py-2 max-w-[12rem] truncate text-muted-foreground">{sampleVal || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleValidate}>
                <ArrowRight size={14} className="mr-2" /> Proceed to Validation
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Validating ────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center gap-4">
            <Loader2 size={36} className="text-teal-500 animate-spin" />
            <p className="font-semibold">Validating {uploadResult?.total_rows.toLocaleString()} rows…</p>
            <p className="text-xs text-muted-foreground">Cleaning values by column type, checking for duplicates.</p>
          </div>
        )}

        {/* ── Step 4: Review ────────────────────────────────────────────────── */}
        {step === 4 && summary && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiStat label="Total" value={summary.total} colorClass="text-foreground" />
              <KpiStat label="Valid" value={summary.valid} colorClass="text-teal-600 dark:text-teal-400" />
              <KpiStat label="Warning" value={summary.warning} colorClass="text-amber-600 dark:text-amber-400" />
              <KpiStat label="Error" value={summary.error} colorClass="text-red-600 dark:text-red-400" />
            </div>

            {summary.warning > 0 && (
              <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-900/10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={includeWarnings}
                  onChange={e => setIncludeWarnings(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Include <strong className="text-amber-600 dark:text-amber-400">{summary.warning.toLocaleString()} warning</strong> rows in import
                  <span className="block text-xs text-muted-foreground">Warnings = type coercion issues or duplicate key updates</span>
                </span>
              </label>
            )}

            {/* Staging table */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b border-border/50 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold mr-auto">Row Preview</p>
                {(["all","valid","warning","error"] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => handleFilterChange(s)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                      statusFilter === s
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    {s === "warning" && summary.warning > 0 && ` (${summary.warning})`}
                    {s === "error"   && summary.error   > 0 && ` (${summary.error})`}
                  </button>
                ))}
              </div>

              {loadingRows ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/50 bg-muted/20">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-12">Row</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">Status</th>
                        {previewCols.slice(0, 2).map(pc => (
                          <th key={pc.col_name} className="text-left px-3 py-2 font-medium text-muted-foreground">{pc.label}</th>
                        ))}
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Issues</th>
                        <th className="w-7" />
                      </tr>
                    </thead>
                    <tbody>
                      {stagingRows.map(row => (
                        <ExpandableRow key={row.id} row={row} previewCols={previewCols} />
                      ))}
                      {stagingRows.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No rows match filter.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {stagingMeta && stagingMeta.total_pages > 1 && (
                <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{stagingMeta.total.toLocaleString()} rows</span>
                  <div className="flex gap-2">
                    <button
                      disabled={stagingPage <= 1}
                      onClick={() => handlePageChange(stagingPage - 1)}
                      className="px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40"
                    >←</button>
                    <span className="px-2 py-1">{stagingPage} / {stagingMeta.total_pages}</span>
                    <button
                      disabled={stagingPage >= stagingMeta.total_pages}
                      onClick={() => handlePageChange(stagingPage + 1)}
                      className="px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40"
                    >→</button>
                  </div>
                </div>
              )}
            </div>

            {summary.error > 0 && (
              <div className="rounded-xl border border-red-200/50 dark:border-red-800/30 bg-red-50/30 dark:bg-red-900/10 px-4 py-3 flex gap-2 text-xs text-red-700 dark:text-red-400">
                <XCircle size={13} className="shrink-0 mt-0.5" />
                <span><strong>{summary.error}</strong> error rows will be skipped (duplicate key in same file).</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={handleReset}>
                <RotateCcw size={14} className="mr-2" /> Start Over
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={importing || (summary.valid === 0 && !(includeWarnings && summary.warning > 0))}
              >
                {importing
                  ? <><Loader2 size={14} className="mr-2 animate-spin" /> Importing…</>
                  : <><CheckCircle2 size={14} className="mr-2" /> Confirm Import</>
                }
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 5: Done ─────────────────────────────────────────────────── */}
        {step === 5 && confirmResult && (
          <div className="rounded-2xl border border-teal-200/50 dark:border-teal-800/30 bg-card p-10 text-center space-y-4">
            <CheckCircle2 size={48} className="mx-auto text-teal-500" />
            <h2 className="text-xl font-bold">Import Complete</h2>
            <div className="flex justify-center gap-6 text-sm">
              <div>
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400 tabular-nums">{confirmResult.inserted.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Inserted</p>
              </div>
              {confirmResult.updated > 0 && (
                <div>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{confirmResult.updated.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Updated</p>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button variant="outline" onClick={handleReset}>
                <Upload size={14} className="mr-2" /> Import Another File
              </Button>
              <Link href={`/dashboard/datasets/${confirmResult.dataset_id}`}>
                <Button>View Dataset</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
