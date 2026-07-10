"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { analyticsApi, chartPrefsApi } from "@/lib/api";
import { toast } from "sonner";
import { RefreshCw, Play, Save, Trash2, ChartBar, Loader2 } from "lucide-react";
import { DynamicChart } from "@/components/charts/dynamic-chart";
import { ChartType, GROUP_BY_OPTIONS, CHART_TYPES } from "@/types/chart";

const METRIC_OPTIONS = [
  { label: "Count Project / Sites", value: "count" },
  { label: "Average Progress Act (%)", value: "avg_progress_act" },
  { label: "Average Progress Closing (%)", value: "avg_progress_closing" },
];

interface FilterOptions {
  provinces: string[];
  cities: string[];
  statusProjects: string[];
  statusPOs: string[];
  mitras: string[];
  vendors: string[];
  categories: string[];
  rfsMonths: string[];
}

export default function DynamicChartBuilderPage() {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [groupBy, setGroupBy] = useState("status_project");
  const [metric, setMetric] = useState("count");

  // Dynamic filter state
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    provinces: [],
    cities: [],
    statusProjects: [],
    statusPOs: [],
    mitras: [],
    vendors: [],
    categories: [],
    rfsMonths: [],
  });

  const [selectedFilters, setSelectedFilters] = useState<Record<string, string>>({
    province: "",
    city: "",
    status_project: "",
    status_po: "",
    mitra_impl: "",
    vendor_principle: "",
    rfs_month: "",
    blocking: "",
  });

  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Load configuration from DB (fallback to localStorage) on mount
  useEffect(() => {
    chartPrefsApi.list().then((res: any) => {
      if (res.success && Array.isArray(res.data)) {
        const pref = res.data.find((p: any) => p.chart_key === "builder");
        if (pref) {
          if (pref.chart_type) setChartType(pref.chart_type as ChartType);
          if (pref.group_by) setGroupBy(pref.group_by);
          if (pref.filters_json) setSelectedFilters(pref.filters_json);
        }
        // metric not stored in DB schema — use localStorage
        const savedMetric = localStorage.getItem("builder_metric");
        if (savedMetric) setMetric(savedMetric);
      } else {
        // fallback: localStorage
        const savedType = localStorage.getItem("builder_chart_type");
        const savedGroupBy = localStorage.getItem("builder_group_by");
        const savedMetric = localStorage.getItem("builder_metric");
        const savedFilters = localStorage.getItem("builder_filters");
        if (savedType) setChartType(savedType as ChartType);
        if (savedGroupBy) setGroupBy(savedGroupBy);
        if (savedMetric) setMetric(savedMetric);
        if (savedFilters) {
          try { setSelectedFilters(JSON.parse(savedFilters)); } catch { /* ignore */ }
        }
      }
    });

    // Load filter options
    analyticsApi.summary().then((res: any) => {
      if (res.success) {
        const c = res.data?.charts ?? {};
        setFilterOpts({
          provinces: (c.by_province || []).map((x: any) => x.label),
          cities: (c.by_city || []).map((x: any) => x.label),
          statusProjects: (c.by_status_project || []).map((x: any) => x.label),
          statusPOs: (c.by_status_po || []).map((x: any) => x.label),
          mitras: (c.by_mitra_impl || []).map((x: any) => x.label),
          vendors: (c.by_vendor_principle || []).map((x: any) => x.label),
          categories: (c.by_project_category || []).map((x: any) => x.label),
          rfsMonths: (c.by_rfs_month || []).map((x: any) => x.label),
        });
      }
    });
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setSelectedFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = useCallback(async () => {
    setLoading(true);
    setChartData(null);

    // Save configurations to DB and localStorage
    localStorage.setItem("builder_metric", metric);
    chartPrefsApi.save({
      chart_key: "builder",
      chart_type: chartType,
      group_by: groupBy,
      filters: selectedFilters,
    });

    // Build query params
    const params: Record<string, any> = {
      group_by: groupBy,
      metric: metric,
    };

    Object.entries(selectedFilters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    try {
      const res: any = await analyticsApi.charts(params);
      if (res.success) {
        setChartData(res.data);
        toast.success("Chart berhasil diperbarui.");
      } else {
        toast.error(res.message || "Gagal memproses data.");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  }, [chartType, groupBy, metric, selectedFilters]);

  // Auto load chart data on mount / config load
  useEffect(() => {
    handleApply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupBy, metric]);

  const handleResetFilters = () => {
    const cleared = {
      province: "",
      city: "",
      status_project: "",
      status_po: "",
      mitra_impl: "",
      vendor_principle: "",
      rfs_month: "",
      blocking: "",
    };
    setSelectedFilters(cleared);
    localStorage.removeItem("builder_filters");
    toast.success("Filter dibersihkan.");
  };

  const getMetricLabel = () => {
    return METRIC_OPTIONS.find((m) => m.value === metric)?.label || metric;
  };

  const getGroupByLabel = () => {
    return GROUP_BY_OPTIONS.find((g) => g.value === groupBy)?.label || groupBy;
  };

  return (
    <AppLayout title="Dynamic Chart Builder">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
        
        {/* Left Control Panel */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ChartBar size={18} className="text-primary" />
                Konfigurasi Chart
              </CardTitle>
              <CardDescription>
                Pilih dimensi, metrik, dan filter untuk visualisasi data secara dinamis.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              
              {/* Chart Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Tipe Visualisasi</label>
                <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value} className="text-xs">
                        {ct.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Group By (Dimension) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Dimensi (Sumbu X / Kategori)</label>
                <Select value={groupBy} onValueChange={setGroupBy}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_BY_OPTIONS.map((g) => (
                      <SelectItem key={g.value} value={g.value} className="text-xs">
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Metric */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Metrik (Nilai Agregat)</label>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METRIC_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Panel Title */}
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Filter Data</span>
                <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground">
                  Reset Filter
                </Button>
              </div>

              {/* Dynamic Filters */}
              <div className="space-y-2 grid grid-cols-2 lg:grid-cols-1 gap-2 lg:space-y-2">
                
                {/* Status Project */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Status Project</span>
                  <Select value={selectedFilters.status_project} onValueChange={(v) => handleFilterChange("status_project", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.statusProjects.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status PO */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Status PO</span>
                  <Select value={selectedFilters.status_po} onValueChange={(v) => handleFilterChange("status_po", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.statusPOs.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Province */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Provinsi</span>
                  <Select value={selectedFilters.province} onValueChange={(v) => handleFilterChange("province", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.provinces.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Mitra Impl */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Mitra Impl</span>
                  <Select value={selectedFilters.mitra_impl} onValueChange={(v) => handleFilterChange("mitra_impl", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.mitras.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Vendor Principle */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Vendor</span>
                  <Select value={selectedFilters.vendor_principle} onValueChange={(v) => handleFilterChange("vendor_principle", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.vendors.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* RFS Month */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Bulan RFS</span>
                  <Select value={selectedFilters.rfs_month} onValueChange={(v) => handleFilterChange("rfs_month", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      {filterOpts.rfsMonths.filter(Boolean).map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Blocking */}
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground block">Blocking</span>
                  <Select value={selectedFilters.blocking} onValueChange={(v) => handleFilterChange("blocking", v)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Semua" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs">Semua</SelectItem>
                      <SelectItem value="1" className="text-xs">Yes (Blocking)</SelectItem>
                      <SelectItem value="0" className="text-xs">No (Not Blocking)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="pt-2 border-t flex gap-2">
                <Button onClick={handleApply} disabled={loading} className="w-full h-9 gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={14} />}
                  Terapkan Visualisasi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Output Panel */}
        <div className="lg:col-span-8">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-base font-bold">Output Visualisasi</CardTitle>
                <CardDescription className="text-xs">
                  Menampilkan <strong>{getMetricLabel()}</strong> berdasarkan <strong>{getGroupByLabel()}</strong>.
                </CardDescription>
              </div>
              <Badge className="bg-primary/10 text-primary capitalize font-mono text-xs border border-primary/20">{chartType}</Badge>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center p-6 min-h-[400px]">
              {loading ? (
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="animate-spin text-primary" size={40} />
                  <p className="text-xs text-muted-foreground font-medium">Memproses data dari server...</p>
                </div>
              ) : chartData ? (
                <div className="w-full h-full min-h-[350px]">
                  <DynamicChart data={chartData} chartType={chartType} height={380} />
                </div>
              ) : (
                <div className="text-center text-muted-foreground space-y-2">
                  <ChartBar size={40} className="mx-auto text-muted-foreground/40" />
                  <p className="font-semibold text-sm">Tidak ada data untuk divisualisasikan</p>
                  <p className="text-xs">Silakan sesuaikan konfigurasi atau filter di panel sebelah kiri.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </AppLayout>
  );
}
