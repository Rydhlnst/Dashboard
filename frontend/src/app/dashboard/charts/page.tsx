"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { datasetsApi, dynamicChartsApi } from "@/lib/api";
import { DynamicChart } from "@/components/charts/dynamic-chart";
import { ChartType } from "@/types/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, BarChart2, Save, Trash2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ColDef { col_name: string; col_type: string; label: string }

interface DatasetListItem {
  id: number;
  name: string;
  table_name: string;
  row_count: number;
}

interface DatasetDetail {
  id: number;
  name: string;
  columns_schema: ColDef[];
}

interface ChartDataItem { label: string; value: number }
interface ChartData { group_by: string; items: ChartDataItem[]; total: number }

interface SavedChart {
  id: number;
  name: string;
  dataset_id: number;
  dataset_name: string;
  chart_type: string;
  x_col: string;
  y_agg: string;
  y_col: string | null;
  filter_col: string | null;
  filter_val: string | null;
  sort_by: string;
  limit_rows: number;
  created_at: string;
}

type AggFunc  = "COUNT" | "SUM" | "AVG" | "MAX" | "MIN";
type SortBy   = "value_desc" | "value_asc" | "label_asc" | "label_desc";

// ─── Constants ───────────────────────────────────────────────────────────────

const AGG_OPTIONS: { value: AggFunc; label: string }[] = [
  { value: "COUNT", label: "Count rows" },
  { value: "SUM",   label: "Sum" },
  { value: "AVG",   label: "Average" },
  { value: "MAX",   label: "Maximum" },
  { value: "MIN",   label: "Minimum" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "value_desc", label: "Highest value first" },
  { value: "value_asc",  label: "Lowest value first" },
  { value: "label_asc",  label: "Label A → Z" },
  { value: "label_desc", label: "Label Z → A" },
];

const LIMIT_OPTIONS = [10, 20, 50, 100];

const BUILDER_CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar",    label: "Bar" },
  { value: "line",   label: "Line" },
  { value: "area",   label: "Area" },
  { value: "pie",    label: "Pie" },
  { value: "donut",  label: "Donut" },
  { value: "radial", label: "H-Bar" },
  { value: "scurve", label: "S-Curve" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isNumericCol(colType: string): boolean {
  return (
    colType.includes("INT") ||
    colType.includes("DECIMAL") ||
    colType.includes("FLOAT") ||
    colType.includes("DOUBLE")
  );
}

function SelectField({
  label, value, onChange, disabled, children, className,
}: {
  label?: string;
  value: string | number;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          {label}
        </p>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {children}
      </select>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DynamicChartBuilderPage() {
  // Datasets list
  const [datasets, setDatasets]           = useState<DatasetListItem[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(true);

  // Selected dataset + schema
  const [datasetId, setDatasetId]         = useState<number>(0);
  const [schema, setSchema]               = useState<ColDef[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(false);

  // Chart config
  const [chartType, setChartType]   = useState<ChartType>("bar");
  const [xCol, setXCol]             = useState("");
  const [yAgg, setYAgg]             = useState<AggFunc>("COUNT");
  const [yCol, setYCol]             = useState("");
  const [filterCol, setFilterCol]   = useState("");
  const [filterVal, setFilterVal]   = useState("");
  const [sortBy, setSortBy]         = useState<SortBy>("value_desc");
  const [limitRows, setLimitRows]   = useState(20);

  // Preview
  const [previewData, setPreviewData]     = useState<ChartData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Save form
  const [chartName, setChartName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);

  // Saved charts
  const [savedCharts, setSavedCharts]   = useState<SavedChart[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLoadRef = useRef<SavedChart | null>(null);

  // ── Load datasets list ────────────────────────────────────────────────────

  useEffect(() => {
    datasetsApi.list()
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setDatasets(res.data as DatasetListItem[]);
        }
      })
      .catch(() => toast.error("Failed to load datasets."))
      .finally(() => setLoadingDatasets(false));
  }, []);

  // ── Load saved charts ─────────────────────────────────────────────────────

  const loadSavedCharts = useCallback(() => {
    setLoadingSaved(true);
    dynamicChartsApi.list()
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setSavedCharts(res.data as SavedChart[]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }, []);

  useEffect(() => { loadSavedCharts(); }, [loadSavedCharts]);

  // ── Load schema when datasetId changes ───────────────────────────────────

  useEffect(() => {
    if (datasetId <= 0) {
      setSchema([]);
      setXCol(""); setYAgg("COUNT"); setYCol("");
      setFilterCol(""); setFilterVal("");
      setPreviewData(null);
      return;
    }

    const hasPending = pendingLoadRef.current?.dataset_id === datasetId;

    if (!hasPending) {
      // Normal dataset change — reset column selections
      setXCol(""); setYAgg("COUNT"); setYCol("");
      setFilterCol(""); setFilterVal("");
      setPreviewData(null);
      setChartName(""); setEditingId(null);
    }

    setLoadingSchema(true);
    datasetsApi.get(datasetId)
      .then(res => {
        if (res.success && res.data) {
          const d = res.data as DatasetDetail;
          setSchema(d.columns_schema ?? []);

          // Apply pending saved chart config now that schema is ready
          const pending = pendingLoadRef.current;
          if (pending && pending.dataset_id === datasetId) {
            setChartType(pending.chart_type as ChartType);
            setXCol(pending.x_col);
            setYAgg(pending.y_agg as AggFunc);
            setYCol(pending.y_col ?? "");
            setFilterCol(pending.filter_col ?? "");
            setFilterVal(pending.filter_val ?? "");
            setSortBy(pending.sort_by as SortBy);
            setLimitRows(pending.limit_rows);
            setChartName(pending.name);
            setEditingId(pending.id);
            pendingLoadRef.current = null;
          }
        }
      })
      .catch(() => toast.error("Failed to load dataset schema."))
      .finally(() => setLoadingSchema(false));
  }, [datasetId]);

  // ── Auto-preview with debounce ────────────────────────────────────────────

  const fetchPreview = useCallback(async () => {
    if (datasetId <= 0 || xCol === "") { setPreviewData(null); return; }
    if (yAgg !== "COUNT" && yCol === "") { setPreviewData(null); return; }

    setLoadingPreview(true);
    try {
      const res = await dynamicChartsApi.aggregate({
        dataset_id: datasetId,
        x_col: xCol,
        y_agg: yAgg,
        y_col: yAgg !== "COUNT" ? yCol : undefined,
        filter_col: filterCol || undefined,
        filter_val: filterVal || undefined,
        sort_by: sortBy,
        limit: limitRows,
      });
      if (res.success && res.data) {
        setPreviewData(res.data as ChartData);
      } else {
        toast.error(res.message || "Failed to load chart data.");
        setPreviewData(null);
      }
    } catch {
      toast.error("Failed to load chart data.");
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [datasetId, xCol, yAgg, yCol, filterCol, filterVal, sortBy, limitRows]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchPreview, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [fetchPreview]);

  // ── Save chart ────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!chartName.trim()) { toast.error("Enter a chart name first."); return; }
    if (!previewData)      { toast.error("Preview the chart first."); return; }
    setSaving(true);
    try {
      const res = await dynamicChartsApi.save({
        id: editingId ?? undefined,
        name: chartName,
        dataset_id: datasetId,
        chart_type: chartType,
        x_col: xCol,
        y_agg: yAgg,
        y_col: yAgg !== "COUNT" ? yCol : undefined,
        filter_col: filterCol || undefined,
        filter_val: filterVal || undefined,
        sort_by: sortBy,
        limit_rows: limitRows,
      });
      if (res.success) {
        toast.success(editingId ? "Chart updated." : "Chart saved.");
        if (!editingId && res.data) {
          const d = res.data as { id: number };
          setEditingId(d.id);
        }
        loadSavedCharts();
      } else {
        toast.error(res.message || "Failed to save.");
      }
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // ── Load saved chart into builder ─────────────────────────────────────────

  const handleLoadChart = (chart: SavedChart) => {
    if (datasetId === chart.dataset_id && schema.length > 0) {
      // Same dataset already loaded — apply config directly
      setChartType(chart.chart_type as ChartType);
      setXCol(chart.x_col);
      setYAgg(chart.y_agg as AggFunc);
      setYCol(chart.y_col ?? "");
      setFilterCol(chart.filter_col ?? "");
      setFilterVal(chart.filter_val ?? "");
      setSortBy(chart.sort_by as SortBy);
      setLimitRows(chart.limit_rows);
      setChartName(chart.name);
      setEditingId(chart.id);
    } else {
      // Different dataset — store pending and trigger schema load
      pendingLoadRef.current = chart;
      setDatasetId(chart.dataset_id);
    }
  };

  // ── Delete saved chart ────────────────────────────────────────────────────

  const handleDeleteChart = async (id: number) => {
    try {
      const res = await dynamicChartsApi.delete(id);
      if (res.success) {
        toast.success("Chart deleted.");
        if (editingId === id) { setEditingId(null); setChartName(""); }
        loadSavedCharts();
      } else {
        toast.error(res.message || "Failed to delete.");
      }
    } catch {
      toast.error("Failed to delete.");
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const numericCols   = schema.filter(c => isNumericCol(c.col_type));
  const yColOptions   = (yAgg === "SUM" || yAgg === "AVG") && numericCols.length > 0
    ? numericCols : schema;
  const configReady   = datasetId > 0 && xCol !== "" && (yAgg === "COUNT" || yCol !== "");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6">

        {/* Header */}
        <div className="mb-5">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BarChart2 size={20} className="text-teal-500" />
            Dynamic Chart Builder
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build and save charts from any dynamic dataset
          </p>
        </div>

        {/* Builder: config (left) + preview (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mb-8">

          {/* ── Config panel ─────────────────────────────────────────────── */}
          <div className="space-y-3">

            {/* Dataset */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Dataset
              </p>
              {loadingDatasets ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" /> Loading…
                </div>
              ) : (
                <select
                  value={datasetId}
                  onChange={e => setDatasetId(Number(e.target.value))}
                  className="w-full h-9 px-3 text-sm rounded-md border border-input bg-background text-foreground"
                >
                  <option value={0}>— select a dataset —</option>
                  {datasets.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({(d.row_count ?? 0).toLocaleString()} rows)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Chart type */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Chart Type
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {BUILDER_CHART_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    type="button"
                    onClick={() => setChartType(ct.value)}
                    className={cn(
                      "h-8 rounded-md border text-xs font-medium transition-colors",
                      chartType === ct.value
                        ? "border-teal-500 bg-teal-500/10 text-teal-600 dark:text-teal-400"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>
            </div>

            {/* X Axis */}
            <div className="rounded-xl border border-border bg-card p-4">
              {loadingSchema ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={13} className="animate-spin" /> Loading columns…
                </div>
              ) : (
                <SelectField
                  label="X Axis — Group By"
                  value={xCol}
                  onChange={setXCol}
                  disabled={schema.length === 0}
                >
                  <option value="">— select column —</option>
                  {schema.map(col => (
                    <option key={col.col_name} value={col.col_name}>
                      {col.label}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>

            {/* Y Axis */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <SelectField
                label="Y Axis — Aggregation"
                value={yAgg}
                onChange={v => { setYAgg(v as AggFunc); if (v === "COUNT") setYCol(""); }}
              >
                {AGG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectField>

              {yAgg !== "COUNT" && (
                <SelectField
                  value={yCol}
                  onChange={setYCol}
                  disabled={schema.length === 0}
                >
                  <option value="">— select column —</option>
                  {yColOptions.map(col => (
                    <option key={col.col_name} value={col.col_name}>
                      {col.label}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>

            {/* Filter (optional) */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <SelectField
                label="Filter (optional)"
                value={filterCol}
                onChange={v => { setFilterCol(v); setFilterVal(""); }}
                disabled={schema.length === 0}
              >
                <option value="">— no filter —</option>
                {schema.map(col => (
                  <option key={col.col_name} value={col.col_name}>
                    {col.label}
                  </option>
                ))}
              </SelectField>

              {filterCol !== "" && (
                <Input
                  value={filterVal}
                  onChange={e => setFilterVal(e.target.value)}
                  placeholder="Filter value…"
                  className="h-9 text-sm"
                />
              )}
            </div>

            {/* Sort + Limit */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <SelectField label="Sort By" value={sortBy} onChange={v => setSortBy(v as SortBy)}>
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectField>

              <SelectField label="Top N" value={limitRows} onChange={v => setLimitRows(Number(v))}>
                {LIMIT_OPTIONS.map(l => <option key={l} value={l}>Top {l} groups</option>)}
              </SelectField>
            </div>
          </div>

          {/* ── Preview panel ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-card p-4 min-h-[440px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Preview</h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchPreview}
                  disabled={!configReady || loadingPreview}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <RefreshCw size={11} className={cn(loadingPreview && "animate-spin")} />
                  Refresh
                </Button>
              </div>

              <div className="flex-1 flex flex-col">
                {loadingPreview ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !configReady ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <BarChart2 size={48} className="opacity-10" />
                    <p className="text-sm text-center max-w-xs">
                      Select a dataset and configure the axes to see a preview
                    </p>
                  </div>
                ) : previewData && previewData.items.length > 0 ? (
                  <>
                    <DynamicChart data={previewData} chartType={chartType} height={380} />
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      {previewData.total} group{previewData.total !== 1 ? "s" : ""}
                    </p>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    No data returned for this configuration.
                  </div>
                )}
              </div>
            </div>

            {/* Save section — only show when preview is ready */}
            {configReady && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  {editingId ? "Update saved chart" : "Save this chart"}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={chartName}
                    onChange={e => setChartName(e.target.value)}
                    placeholder="Chart name…"
                    className="h-9 text-sm flex-1"
                    onKeyDown={e => e.key === "Enter" && handleSave()}
                  />
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || !chartName.trim() || !previewData}
                    className="h-9 gap-1.5"
                  >
                    {saving
                      ? <Loader2 size={13} className="animate-spin" />
                      : <Save size={13} />}
                    {editingId ? "Update" : "Save"}
                  </Button>
                  {editingId && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 text-xs"
                      onClick={() => { setEditingId(null); setChartName(""); }}
                    >
                      New
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Saved charts ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold">Saved Charts</h2>
            {loadingSaved && <Loader2 size={13} className="animate-spin text-muted-foreground" />}
          </div>

          {!loadingSaved && savedCharts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground text-sm">
              No saved charts yet — configure a chart above and save it.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {savedCharts.map(chart => (
                <div
                  key={chart.id}
                  className={cn(
                    "rounded-xl border bg-card p-4 transition-colors",
                    editingId === chart.id
                      ? "border-teal-500 ring-1 ring-teal-500/30"
                      : "border-border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-semibold leading-tight">{chart.name}</h3>
                    <button
                      type="button"
                      onClick={() => handleDeleteChart(chart.id)}
                      className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-destructive transition-colors"
                      title="Delete chart"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p className="text-xs text-muted-foreground mb-3 truncate">{chart.dataset_name}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="text-[10px] font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded capitalize">
                      {chart.chart_type}
                    </span>
                    <span className="text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {chart.x_col}
                    </span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                      {chart.y_agg}{chart.y_col ? `(${chart.y_col})` : "(*)"}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs"
                    onClick={() => handleLoadChart(chart)}
                  >
                    Load
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
