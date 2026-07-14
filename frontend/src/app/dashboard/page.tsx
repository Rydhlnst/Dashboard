"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { analyticsApi, datasetsApi } from "@/lib/api";
import { SummaryResponse } from "@/types/project";
import { KpiCard } from "@/components/ui/kpi-card";
import { ReportRangeFilter, getReportRange } from "@/components/filters/report-range-filter";
import { formatNumber, cn } from "@/lib/utils";
import {
  FolderKanban, CheckCircle2, AlertTriangle, Clock, TrendingUp, Percent,
  RefreshCw, CalendarClock, Activity, Columns3, DatabaseZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ComposedChart,
} from "recharts";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const COLORS = [
  "#171717", "#404040", "#525252", "#737373", "#a3a3a3",
  "#262626", "#595959", "#8c8c8c", "#b3b3b3", "#d4d4d4",
];

const GRID_STROKE = "hsl(var(--border))";
const TICK_FILL = "hsl(var(--muted-foreground))";
const TOOLTIP_STYLE: React.CSSProperties = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
  fontSize: "12px",
};

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card rounded-xl border border-t-2 border-t-border p-4 shadow-sm ${className ?? ""}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">{title}</p>
      {children}
    </div>
  );
}

interface DatasetOption {
  id: number;
  name: string;
  page_label: string | null;
}

interface DsChart {
  col: string;
  items: { label: string; value: number }[];
}

interface DsSummary {
  dataset: { id: number; name: string; column_count: number };
  kpi: { total: number; column_count: number; last_update: string | null };
  charts: DsChart[];
  numeric_stats: { col: string; total: number; avg: number; filled: number }[];
}

export default function DashboardOverviewPage() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState(() => getReportRange("monthly"));

  // Dynamic dataset selector
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [dsSummary, setDsSummary] = useState<DsSummary | null>(null);

  // Fetch available dynamic datasets for the selector
  useEffect(() => {
    datasetsApi.list().then((res) => {
      if (res.success) {
        const all = ((res.data as any)?.datasets ?? []) as DatasetOption[];
        setDatasets(all);
      }
    }).catch(() => {});
  }, []);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedDatasetId !== null) {
        // Dynamic dataset mode
        const res = await analyticsApi.datasetSummary(selectedDatasetId) as { success: boolean; data: DsSummary; message?: string };
        if (res.success) {
          setDsSummary(res.data);
          setData(null);
        } else {
          toast.error(res.message || "Failed to load dataset summary.");
        }
      } else {
        // Default mode: project_records
        const res = await analyticsApi.summary(reportRange as unknown as Record<string, string | undefined>) as { success: boolean; data: SummaryResponse; message?: string };
        if (res.success) {
          setData(res.data);
          setDsSummary(null);
        } else {
          toast.error(res.message || "Failed to load summary.");
        }
      }
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [reportRange, selectedDatasetId]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Default mode (project_records) ─────────────────────────────────────────
  const kpi    = data?.kpi;
  const charts = data?.charts;
  const lastUpdate = kpi?.last_update ? format(new Date(kpi.last_update), "dd MMM yyyy HH:mm") : "-";
  const progressPct = kpi ? Math.round(kpi.progress_pct * 10) / 10 : 0;

  // ── Dynamic dataset mode ────────────────────────────────────────────────────
  const dsKpi      = dsSummary?.kpi;
  const dsCharts   = dsSummary?.charts ?? [];
  const dsLastUpdate = dsKpi?.last_update ? format(new Date(dsKpi.last_update), "dd MMM yyyy HH:mm") : "-";
  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

  return (
    <AppLayout title="Overview">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity size={18} className="text-muted-foreground" />
            <p className="text-lg font-semibold tracking-tight text-foreground">Status &amp; Analytics</p>
          </div>
          <p className="text-xs text-muted-foreground ml-7">
            {selectedDatasetId === null
              ? "Real-time monitoring across all datasets"
              : `Overview for: ${selectedDataset?.page_label ?? selectedDataset?.name ?? "Dataset"}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Dataset selector */}
          <Select
            value={selectedDatasetId === null ? "all" : String(selectedDatasetId)}
            onValueChange={(v) => setSelectedDatasetId(v === "all" ? null : Number(v))}
          >
            <SelectTrigger className="h-8 text-xs w-44 gap-1.5">
              <DatabaseZap size={12} className="text-muted-foreground shrink-0" />
              <SelectValue placeholder="Pilih dataset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Data</SelectItem>
              {datasets.map((ds) => (
                <SelectItem key={ds.id} value={String(ds.id)}>
                  {ds.page_label ?? ds.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={loading} className="gap-1.5 h-8">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>
      </div>

      {/* ── Report range filter (only for default mode) ── */}
      {selectedDatasetId === null && (
        <ReportRangeFilter value={reportRange} onChange={setReportRange} className="mb-6" />
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DEFAULT MODE — project_records KPIs & Charts
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedDatasetId === null && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard title="Total SOW"        value={loading ? "..." : formatNumber(kpi?.total ?? 0)}     icon={FolderKanban}  iconColor="text-sky-600" />
            <KpiCard title="RFS / Completed"  value={loading ? "..." : formatNumber(kpi?.completed ?? 0)} icon={CheckCircle2}  iconColor="text-emerald-600" />
            <KpiCard title="NY / Remaining"   value={loading ? "..." : formatNumber(kpi?.remaining ?? 0)} icon={Clock}         iconColor="text-amber-600" />
            <KpiCard title="Progress %"       value={loading ? "..." : `${progressPct}%`}                 icon={Percent}       iconColor="text-violet-600" />
            <KpiCard title="Drop / Cancelled" value={loading ? "..." : formatNumber(kpi?.dropped ?? 0)}   icon={AlertTriangle} iconColor="text-rose-600" />
            <KpiCard title="Issues / Blocking" value={loading ? "..." : formatNumber(kpi?.issues ?? 0)}   icon={TrendingUp}    iconColor="text-orange-600" />
            <KpiCard title="Last Update"      value={loading ? "..." : lastUpdate}                        icon={CalendarClock} iconColor="text-teal-600" />
          </div>

          <Tabs defaultValue="trend" className="mb-5">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="trend">Monthly Trend</TabsTrigger>
              <TabsTrigger value="category">Project Category</TabsTrigger>
              <TabsTrigger value="issues">Issue Category</TabsTrigger>
              <TabsTrigger value="location">NOP</TabsTrigger>
              <TabsTrigger value="vendor">Vendor Principle</TabsTrigger>
              <TabsTrigger value="partner">Mitra Impl</TabsTrigger>
              <TabsTrigger value="pending">Pending Sites</TabsTrigger>
            </TabsList>

            <TabsContent value="trend">
              <ChartCard title="RFS vs Remaining - by Month">
                <div className="h-64">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_month?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={charts.by_month.map(d => ({ name: d.label, RFS: d.rfs, NY: d.ny }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: "8px" }} />
                        <Bar dataKey="RFS" fill="#171717" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="NY" fill="#a3a3a3" radius={[6, 6, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="category">
              <ChartCard title="Progress by Project Category">
                <div className="h-52">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_project_category?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.by_project_category.slice(0, 10).map(d => ({ name: d.label, Sites: d.value }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: TICK_FILL }} width={110} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="Sites" fill="#171717" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="issues">
              <ChartCard title="Top Issue Categories">
                <div className="h-52">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_issue_category?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.by_issue_category.slice(0, 8).map(d => ({ name: d.label, count: d.value }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: TICK_FILL }} angle={-20} textAnchor="end" height={50} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" fill="#404040" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No issue data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="location">
              <ChartCard title="Sites by NOP">
                <div className="h-48">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_nop?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.by_nop.slice(0, 8).map(d => ({ name: d.label, Sites: d.value }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_STROKE} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="Sites" fill="#262626" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="vendor">
              <ChartCard title="Sites by Vendor Principle">
                <div className="h-48">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_vendor_principle?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.by_vendor_principle.map(d => ({ name: d.label, value: d.value }))}
                          dataKey="value" cx="50%" cy="50%"
                          innerRadius={42} outerRadius={68} paddingAngle={3} strokeWidth={0}
                        >
                          {charts.by_vendor_principle.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="partner">
              <ChartCard title="Sites by Mitra Impl">
                <div className="h-48">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Loading...</div>
                  ) : charts?.by_mitra_impl?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={charts.by_mitra_impl.slice(0, 8).map(d => ({ name: d.label, Sites: d.value }))} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: TICK_FILL }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="Sites" fill="#171717" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
                  )}
                </div>
              </ChartCard>
            </TabsContent>

            <TabsContent value="pending">
              <ChartCard title="Top 10 Pending Sites">
                {loading ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">Loading...</p>
                ) : !data?.top_pending?.length ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No pending sites</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="text-left pb-2.5 font-semibold text-muted-foreground w-6">#</th>
                          <th className="text-left pb-2.5 font-semibold text-muted-foreground">Site Name</th>
                          <th className="text-left pb-2.5 font-semibold text-muted-foreground">Category</th>
                          <th className="text-left pb-2.5 font-semibold text-muted-foreground">Mitra</th>
                          <th className="text-right pb-2.5 font-semibold text-muted-foreground">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.top_pending.slice(0, 10).map((row, i) => {
                          const progress = Number(row.progress_act ?? 0);
                          return (
                            <tr key={i} className={cn("border-b border-border/30 last:border-0 transition-colors", i === 0 ? "bg-muted/70" : "hover:bg-muted/40")}>
                              <td className="py-2 font-mono text-muted-foreground">{i + 1}</td>
                              <td className="py-2 font-medium truncate max-w-40">{row.site_name ?? "-"}</td>
                              <td className="py-2 text-muted-foreground truncate max-w-28">{row.project_category ?? "-"}</td>
                              <td className="py-2 text-muted-foreground truncate max-w-28">{row.mitra_impl ?? "-"}</td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="progress-bar-inline">
                                    <div className="fill" style={{ width: `${Math.min(progress, 100)}%` }} />
                                  </div>
                                  <span className="font-mono text-muted-foreground w-9 text-right">{progress}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </ChartCard>
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DYNAMIC DATASET MODE — generic KPIs & column breakdown charts
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedDatasetId !== null && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <KpiCard
              title="Total Records"
              value={loading ? "..." : formatNumber(dsKpi?.total ?? 0)}
              icon={FolderKanban}
              iconColor="text-sky-600"
            />
            <KpiCard
              title="Columns"
              value={loading ? "..." : formatNumber(dsKpi?.column_count ?? 0)}
              icon={Columns3}
              iconColor="text-violet-600"
            />
            <KpiCard
              title="Last Update"
              value={loading ? "..." : dsLastUpdate}
              icon={CalendarClock}
              iconColor="text-teal-600"
            />
          </div>

          {/* Column breakdown charts */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-xs text-muted-foreground">Loading...</div>
          ) : dsCharts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 flex flex-col items-center gap-2 text-center">
              <Columns3 size={28} className="text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No categorical columns to chart</p>
              <p className="text-xs text-muted-foreground/60 max-w-xs">
                This dataset has no text columns with 2–9 distinct values suitable for breakdown charts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              {dsCharts.map((chart) => (
                <ChartCard key={chart.col} title={chart.col.replace(/_/g, " ")}>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chart.items.map(i => ({ name: i.label, value: i.value }))}
                        layout="vertical"
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_STROKE} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: TICK_FILL }} axisLine={false} tickLine={false} />
                        <YAxis
                          dataKey="name"
                          type="category"
                          tick={{ fontSize: 10, fill: TICK_FILL }}
                          width={120}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="value" fill="#171717" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              ))}
            </div>
          )}

          {/* Numeric stats (if any) */}
          {!loading && (dsSummary?.numeric_stats?.length ?? 0) > 0 && (
            <ChartCard title="Numeric Column Summary" className="mb-5">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="text-left pb-2 font-semibold text-muted-foreground">Column</th>
                      <th className="text-right pb-2 font-semibold text-muted-foreground">Total</th>
                      <th className="text-right pb-2 font-semibold text-muted-foreground">Average</th>
                      <th className="text-right pb-2 font-semibold text-muted-foreground">Filled Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dsSummary!.numeric_stats.map((ns, i) => (
                      <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="py-2 font-medium">{ns.col.replace(/_/g, " ")}</td>
                        <td className="py-2 text-right font-mono">{ns.total.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-muted-foreground">{ns.avg.toLocaleString()}</td>
                        <td className="py-2 text-right font-mono text-muted-foreground">{ns.filled.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ChartCard>
          )}
        </>
      )}
    </AppLayout>
  );
}
