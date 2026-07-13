"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { datasetsApi, dynamicChartsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Loader2, Search, ChevronLeft, ChevronRight, DatabaseZap,
  ArrowLeft, Pencil, Trash2, Save, BarChart2, Table2, Plus, RefreshCw,
  Download, FileSpreadsheet, Upload,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DynamicChart } from "@/components/charts/dynamic-chart";
import { ChartType } from "@/types/chart";
import { PageTour } from "@/components/tour/page-tour";
import type { Step } from "react-joyride";

const DATASET_TOUR_STEPS: Step[] = [
  {
    target: "body",
    placement: "center",
    title: "Panduan Halaman Dataset",
    content:
      "Halaman ini menampilkan seluruh data dataset Anda, dengan tab untuk melihat/edit data serta membuat chart khusus.",
    disableBeacon: true,
  },
  {
    target: '[data-tour="dataset-tabs"]',
    title: "Tab Data & Charts",
    content:
      "Tab Data untuk melihat & edit baris. Tab Charts untuk membuat visualisasi khusus dataset ini (bar, line, pie, dll).",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="dataset-export"]',
    title: "Export CSV / Excel",
    content:
      "Export seluruh data yang sedang tampil (mengikuti filter search) ke CSV atau Excel. Format tanggal & angka sudah disesuaikan dengan file sumber.",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="dataset-reimport"]',
    title: "Rubah Sumber Data",
    content:
      "Klik di sini untuk mengganti/memperbarui data dataset ini dari file baru. Kolom yang tidak ada di file baru akan tetap dipertahankan; kolom baru otomatis ditambahkan.",
    disableBeacon: true,
    placement: "bottom",
  },
  {
    target: '[data-tour="row-actions"]',
    title: "Edit / Hapus Baris",
    content:
      "Klik ikon pensil untuk edit baris (semua kolom bisa diubah), atau ikon tempat sampah untuk hapus.",
    disableBeacon: true,
    placement: "left",
  },
];

interface ColDef { col_name: string; col_type: string; label: string }

interface Dataset {
  id: number;
  name: string;
  table_name: string;
  schema: ColDef[];
}

interface Meta { total: number; page: number; limit: number; total_pages: number }

const LIMIT_OPTIONS = [20, 50, 100];

function cellValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  return String(val);
}

function isNumericType(t: string) {
  const u = t.toUpperCase();
  return u.includes("INT") || u.includes("DECIMAL") || u.includes("FLOAT") || u.includes("DOUBLE");
}

function inputTypeFor(t: string): string {
  const u = t.toUpperCase();
  if (u === "DATE") return "date";
  if (isNumericType(u)) return "number";
  return "text";
}

// ─── Row editor dialog ────────────────────────────────────────────────────────

function RowEditor({
  open, onOpenChange, row, schema, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  row: Record<string, unknown> | null;
  schema: ColDef[];
  onSave: (values: Record<string, string>) => Promise<void>;
  saving: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!row) return;
    const next: Record<string, string> = {};
    for (const c of schema) {
      const v = row[c.col_name];
      next[c.col_name] = v === null || v === undefined ? "" : String(v);
    }
    setValues(next);
  }, [row, schema]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Row {row?._id ? `#${row._id}` : ""}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          {schema.map(col => (
            <div key={col.col_name} className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 items-center">
              <label htmlFor={`f_${col.col_name}`} className="text-xs font-medium text-muted-foreground sm:text-right">
                {col.label}
                <span className="block text-[9px] font-mono opacity-50">{col.col_type}</span>
              </label>
              <Input
                id={`f_${col.col_name}`}
                type={inputTypeFor(col.col_type)}
                step={isNumericType(col.col_type) ? "any" : undefined}
                value={values[col.col_name] ?? ""}
                onChange={e => setValues(prev => ({ ...prev, [col.col_name]: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
          ))}
          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
              Save Row
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Charts sub-tab ───────────────────────────────────────────────────────────

type AggFunc = "COUNT" | "SUM" | "AVG" | "MAX" | "MIN";
type SortBy = "value_desc" | "value_asc" | "label_asc" | "label_desc";

const AGG_OPTIONS: { value: AggFunc; label: string }[] = [
  { value: "COUNT", label: "Count rows" },
  { value: "SUM",   label: "Sum" },
  { value: "AVG",   label: "Average" },
  { value: "MAX",   label: "Maximum" },
  { value: "MIN",   label: "Minimum" },
];

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar",    label: "Bar" },
  { value: "line",   label: "Line" },
  { value: "area",   label: "Area" },
  { value: "pie",    label: "Pie" },
  { value: "donut",  label: "Donut" },
  { value: "radial", label: "H-Bar" },
];

interface SavedChart {
  id: number;
  name: string;
  dataset_id: number;
  chart_type: string;
  x_col: string;
  y_agg: string;
  y_col: string | null;
  filter_col: string | null;
  filter_val: string | null;
  sort_by: string;
  limit_rows: number;
}

interface ChartDataItem { label: string; value: number }
interface ChartAggData { group_by: string; items: ChartDataItem[]; total: number }

function ChartCard({
  chart, dataset,
}: {
  chart: SavedChart;
  dataset: Dataset;
}) {
  const [data, setData] = useState<ChartAggData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dynamicChartsApi.aggregate({
        dataset_id: dataset.id,
        x_col: chart.x_col,
        y_agg: chart.y_agg,
        y_col: chart.y_agg !== "COUNT" ? chart.y_col ?? undefined : undefined,
        filter_col: chart.filter_col ?? undefined,
        filter_val: chart.filter_val ?? undefined,
        sort_by: chart.sort_by,
        limit: chart.limit_rows,
      });
      if (res.success && res.data) setData(res.data as ChartAggData);
    } finally {
      setLoading(false);
    }
  }, [chart, dataset.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold">{chart.name}</h3>
      </div>
      {loading ? (
        <div className="h-[240px] flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : data && data.items.length > 0 ? (
        <DynamicChart data={data} chartType={chart.chart_type as ChartType} height={240} />
      ) : (
        <div className="h-[240px] flex items-center justify-center text-xs text-muted-foreground">
          No data.
        </div>
      )}
    </div>
  );
}

function ChartsTab({ dataset }: { dataset: Dataset }) {
  const [charts, setCharts] = useState<SavedChart[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // Builder state
  const [chartName, setChartName] = useState("");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [xCol, setXCol] = useState("");
  const [yAgg, setYAgg] = useState<AggFunc>("COUNT");
  const [yCol, setYCol] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("value_desc");
  const [limitRows, setLimitRows] = useState(20);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ChartAggData | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dynamicChartsApi.list(dataset.id);
      if (res.success && Array.isArray(res.data)) setCharts(res.data as SavedChart[]);
    } finally {
      setLoading(false);
    }
  }, [dataset.id]);

  useEffect(() => { load(); }, [load]);

  const configReady = xCol !== "" && (yAgg === "COUNT" || yCol !== "");

  const fetchPreview = useCallback(async () => {
    if (!configReady) { setPreview(null); return; }
    setPreviewing(true);
    try {
      const res = await dynamicChartsApi.aggregate({
        dataset_id: dataset.id,
        x_col: xCol,
        y_agg: yAgg,
        y_col: yAgg !== "COUNT" ? yCol : undefined,
        sort_by: sortBy,
        limit: limitRows,
      });
      if (res.success && res.data) setPreview(res.data as ChartAggData);
    } finally {
      setPreviewing(false);
    }
  }, [dataset.id, xCol, yAgg, yCol, sortBy, limitRows, configReady]);

  useEffect(() => {
    if (!showBuilder) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(fetchPreview, 500);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [fetchPreview, showBuilder]);

  const resetBuilder = () => {
    setChartName(""); setChartType("bar"); setXCol("");
    setYAgg("COUNT"); setYCol(""); setSortBy("value_desc");
    setLimitRows(20); setEditingId(null); setPreview(null);
  };

  const openBuilderNew = () => { resetBuilder(); setShowBuilder(true); };

  const openBuilderEdit = (c: SavedChart) => {
    setChartName(c.name);
    setChartType(c.chart_type as ChartType);
    setXCol(c.x_col);
    setYAgg(c.y_agg as AggFunc);
    setYCol(c.y_col ?? "");
    setSortBy(c.sort_by as SortBy);
    setLimitRows(c.limit_rows);
    setEditingId(c.id);
    setShowBuilder(true);
  };

  const handleSave = async () => {
    if (!chartName.trim()) { toast.error("Enter a chart name."); return; }
    if (!configReady) { toast.error("Pick X column and (if not COUNT) Y column."); return; }
    setSaving(true);
    try {
      const res = await dynamicChartsApi.save({
        id: editingId ?? undefined,
        name: chartName.trim(),
        dataset_id: dataset.id,
        chart_type: chartType,
        x_col: xCol,
        y_agg: yAgg,
        y_col: yAgg !== "COUNT" ? yCol : undefined,
        sort_by: sortBy,
        limit_rows: limitRows,
      });
      if (res.success) {
        toast.success(editingId ? "Chart updated." : "Chart saved.");
        setShowBuilder(false);
        resetBuilder();
        load();
      } else {
        toast.error(res.message || "Failed to save.");
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this chart?")) return;
    const res = await dynamicChartsApi.delete(id);
    if (res.success) { toast.success("Chart deleted."); load(); }
    else toast.error(res.message || "Failed to delete.");
  };

  const numericCols = dataset.schema.filter(c => isNumericType(c.col_type));
  const yColOptions = (yAgg === "SUM" || yAgg === "AVG") && numericCols.length > 0 ? numericCols : dataset.schema;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Charts for {dataset.name}</p>
          <p className="text-xs text-muted-foreground">Configure charts scoped to this dataset.</p>
        </div>
        <Button size="sm" onClick={openBuilderNew}>
          <Plus size={13} className="mr-1.5" /> New Chart
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : charts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          No charts yet. Click <strong>New Chart</strong> to build one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {charts.map(c => (
            <div key={c.id} className="relative group">
              <ChartCard chart={c} dataset={dataset} />
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openBuilderEdit(c)}
                  className="p-1.5 rounded-md bg-background border border-border text-muted-foreground hover:text-foreground shadow-sm"
                  title="Edit"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-1.5 rounded-md bg-background border border-border text-muted-foreground hover:text-destructive shadow-sm"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Builder dialog */}
      <Dialog open={showBuilder} onOpenChange={(v) => { setShowBuilder(v); if (!v) resetBuilder(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Chart" : "New Chart"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Config */}
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                <Input value={chartName} onChange={e => setChartName(e.target.value)} placeholder="e.g. Progress per Region" className="h-9 text-sm mt-1" />
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chart Type</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                  {CHART_TYPES.map(ct => (
                    <button
                      key={ct.value} type="button" onClick={() => setChartType(ct.value)}
                      className={cn("h-8 rounded-md border text-xs font-medium transition-colors",
                        chartType === ct.value
                          ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                          : "border-border bg-background text-muted-foreground hover:text-foreground")}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Group by (X)</label>
                <select value={xCol} onChange={e => setXCol(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground mt-1">
                  <option value="">— pick column —</option>
                  {dataset.schema.map(c => <option key={c.col_name} value={c.col_name}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Aggregation (Y)</label>
                <select value={yAgg} onChange={e => { setYAgg(e.target.value as AggFunc); if (e.target.value === "COUNT") setYCol(""); }}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground mt-1">
                  {AGG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {yAgg !== "COUNT" && (
                  <select value={yCol} onChange={e => setYCol(e.target.value)}
                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground mt-2">
                    <option value="">— pick numeric column —</option>
                    {yColOptions.map(c => <option key={c.col_name} value={c.col_name}>{c.label}</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sort</label>
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground mt-1">
                    <option value="value_desc">Value ↓</option>
                    <option value="value_asc">Value ↑</option>
                    <option value="label_asc">Label A–Z</option>
                    <option value="label_desc">Label Z–A</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Top N</label>
                  <select value={limitRows} onChange={e => setLimitRows(Number(e.target.value))}
                    className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground mt-1">
                    {[10, 20, 50, 100].map(l => <option key={l} value={l}>Top {l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl border border-border bg-muted/10 p-3 min-h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground">Preview</p>
                {previewing && <Loader2 size={12} className="animate-spin text-muted-foreground" />}
              </div>
              <div className="flex-1 flex items-center justify-center">
                {!configReady ? (
                  <p className="text-xs text-muted-foreground text-center">Pick columns to preview.</p>
                ) : preview && preview.items.length > 0 ? (
                  <div className="w-full"><DynamicChart data={preview} chartType={chartType} height={280} /></div>
                ) : previewing ? null : (
                  <p className="text-xs text-muted-foreground">No data.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBuilder(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !configReady || !chartName.trim()}>
              {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Save size={14} className="mr-2" />}
              {editingId ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Data sub-tab ─────────────────────────────────────────────────────────────

function DataTab({
  datasetId, dataset, onDatasetLoaded,
}: {
  datasetId: number;
  dataset: Dataset | null;
  onDatasetLoaded: (d: Dataset) => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sortCol, setSortCol] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [editRow, setEditRow] = useState<Record<string, unknown> | null>(null);
  const [savingRow, setSavingRow] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<number | null>(null);
  const [deletingRow, setDeletingRow] = useState(false);

  const load = useCallback(async (p: number, s: string, sc: string, sd: string) => {
    setLoading(true);
    try {
      const res = await datasetsApi.query({ dataset_id: datasetId, page: p, limit, search: s || undefined, sort_col: sc || undefined, sort_dir: sd });
      if (res.success) {
        const d = res.data as { dataset: Dataset; rows: Record<string, unknown>[]; meta: Meta };
        onDatasetLoaded(d.dataset);
        setRows(d.rows);
        setMeta(d.meta);
      } else {
        toast.error(res.message || "Failed to load data.");
      }
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [datasetId, limit, onDatasetLoaded]);

  useEffect(() => { load(page, search, sortCol, sortDir); }, [load, page, search, sortCol, sortDir]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const handleSaveRow = async (values: Record<string, string>) => {
    if (!editRow || !dataset) return;
    setSavingRow(true);
    try {
      const rowId = Number(editRow._id);
      const res = await datasetsApi.updateRow(dataset.id, rowId, values);
      if (res.success) {
        const d = res.data as { row: Record<string, unknown> };
        setRows(prev => prev.map(r => Number(r._id) === rowId ? d.row : r));
        setEditRow(null);
        toast.success("Row updated.");
      } else {
        toast.error(res.message || "Update failed.");
      }
    } catch {
      toast.error("Update failed.");
    } finally {
      setSavingRow(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!deleteRowId || !dataset) return;
    setDeletingRow(true);
    try {
      const res = await datasetsApi.deleteRow(dataset.id, deleteRowId);
      if (res.success) {
        setRows(prev => prev.filter(r => Number(r._id) !== deleteRowId));
        setMeta(m => m ? { ...m, total: Math.max(0, m.total - 1) } : m);
        toast.success("Row deleted.");
      } else {
        toast.error(res.message || "Delete failed.");
      }
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeletingRow(false);
      setDeleteRowId(null);
    }
  };

  const visibleCols = dataset?.schema ?? [];

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2 flex-1 min-w-0 max-w-md">
          <Input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search text columns…"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-8 px-3">
            <Search size={13} />
          </Button>
        </div>

        <select
          value={limit}
          onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
          className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
        >
          {LIMIT_OPTIONS.map(l => <option key={l} value={l}>{l} / page</option>)}
        </select>

        <Button size="sm" variant="ghost" className="h-8 px-2 gap-1" onClick={() => load(page, search, sortCol, sortDir)}>
          <RefreshCw size={13} />
        </Button>

        <div className="flex items-center gap-2" data-tour="dataset-export">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.open(datasetsApi.csvUrl(datasetId, search || undefined), "_blank")}
          >
            <Download size={13} />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => window.open(datasetsApi.excelUrl(datasetId, search || undefined), "_blank")}
          >
            <FileSpreadsheet size={13} />
            Excel
          </Button>
          <Link href={`/dashboard/import?dataset_id=${datasetId}`} data-tour="dataset-reimport">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Upload size={13} />
              Re-import source
            </Button>
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : visibleCols.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No columns found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-border/50 bg-muted/20">
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground w-10 shrink-0">#</th>
                  {visibleCols.map(col => (
                    <th
                      key={col.col_name}
                      className="text-left px-3 py-2.5 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors"
                      onClick={() => handleSort(col.col_name)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortCol === col.col_name && (
                          <span className="text-teal-500">{sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </span>
                      <span className="block text-[9px] font-normal text-muted-foreground/50 font-mono">
                        {col.col_type}
                      </span>
                    </th>
                  ))}
                  <th className="text-right px-3 py-2.5 font-medium text-muted-foreground w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={String(row._id ?? ri)} className="border-t border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-muted-foreground/50 tabular-nums">
                      {((page - 1) * limit) + ri + 1}
                    </td>
                    {visibleCols.map(col => (
                      <td key={col.col_name} className="px-3 py-2 max-w-[14rem] truncate text-foreground/80">
                        {cellValue(row[col.col_name])}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right" data-tour={ri === 0 ? "row-actions" : undefined}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setEditRow(row)}
                          className="p-1 rounded text-muted-foreground hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors"
                          title="Edit row"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          onClick={() => setDeleteRowId(Number(row._id))}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete row"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={visibleCols.length + 2} className="text-center py-12 text-muted-foreground">
                      No data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {((page - 1) * limit + 1).toLocaleString()}–{Math.min(page * limit, meta.total).toLocaleString()} of {meta.total.toLocaleString()}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <span className="px-2 py-1">Page {page} / {meta.total_pages}</span>
            <button
              disabled={page >= meta.total_pages}
              onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-2 py-1 rounded-md border border-border hover:bg-muted disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}

      <RowEditor
        open={editRow !== null}
        onOpenChange={(v) => !v && setEditRow(null)}
        row={editRow}
        schema={visibleCols}
        onSave={handleSaveRow}
        saving={savingRow}
      />

      <AlertDialog open={deleteRowId !== null} onOpenChange={(v) => !v && setDeleteRowId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Row</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete row #{deleteRowId} from this dataset. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRow}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRow}
              disabled={deletingRow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRow ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DatasetDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [tab, setTab] = useState<"data" | "charts">("data");

  const handleDatasetLoaded = useCallback((d: Dataset) => {
    setDataset(prev => {
      if (prev && prev.id === d.id && prev.schema.length === d.schema.length) return prev;
      return d;
    });
  }, []);

  // Prime dataset early so the Charts tab works even if it's opened first
  useEffect(() => {
    if (!id || dataset) return;
    datasetsApi.get(id).then(res => {
      if (res.success && res.data) {
        const d = res.data as { id: number; name: string; table_name: string; columns_schema: ColDef[] };
        handleDatasetLoaded({ id: d.id, name: d.name, table_name: d.table_name, schema: d.columns_schema ?? [] });
      }
    }).catch(() => {});
  }, [id, dataset, handleDatasetLoaded]);

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Link href="/dashboard/datasets">
            <Button size="sm" variant="ghost" className="gap-1.5">
              <ArrowLeft size={13} /> Datasets
            </Button>
          </Link>
          {dataset && (
            <>
              <span className="text-border/60">|</span>
              <div className="flex items-center gap-2">
                <DatabaseZap size={15} className="text-teal-500" />
                <h1 className="text-lg font-bold">{dataset.name}</h1>
                <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">
                  {dataset.table_name}
                </span>
              </div>
            </>
          )}
          <div className="ml-auto">
            <PageTour storageKey="tour.dataset-detail.v1" steps={DATASET_TOUR_STEPS} />
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "data" | "charts")}>
          <TabsList data-tour="dataset-tabs">
            <TabsTrigger value="data" className="gap-1.5">
              <Table2 size={13} /> Data
            </TabsTrigger>
            <TabsTrigger value="charts" className="gap-1.5">
              <BarChart2 size={13} /> Charts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="data">
            <DataTab datasetId={id} dataset={dataset} onDatasetLoaded={handleDatasetLoaded} />
          </TabsContent>

          <TabsContent value="charts">
            {dataset ? (
              <ChartsTab dataset={dataset} />
            ) : (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
