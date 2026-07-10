"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { PaginationBar } from "@/components/tables/pagination-bar";
import { GlobalFilterDrawer, FilterValues } from "@/components/filters/global-filter-drawer";
import { ExportButtons } from "@/components/export/export-buttons";
import { ReportRangeFilter, getReportRange } from "@/components/filters/report-range-filter";
import { ExportableChartCard } from "@/components/charts/exportable-chart-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectApi, analyticsApi } from "@/lib/api";
import { ProjectRecord, SummaryResponse } from "@/types/project";
import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { Filter, CheckCircle2, Clock, TrendingUp } from "lucide-react";

const ch = createColumnHelper<ProjectRecord>();

const COLUMNS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("pdid", { header: "PDID", enableSorting: true }),
  ch.accessor("po_year", { header: "PO Year" }),
  ch.accessor("scarlett_ioms_id_before", { header: "IOMS Before" }),
  ch.accessor("scarlett_ioms_id_final", { header: "IOMS Final" }),
  ch.accessor("status_po", {
    header: "Status PO",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? <Badge variant={v.toLowerCase() === "drop" ? "destructive" : "secondary"}>{v}</Badge> : null;
    },
  }),
  ch.accessor("pono_tsel", { header: "PoNo Tsel" }),
  ch.accessor("project_category", { header: "Project Category" }),
  ch.accessor("sow_actual", { header: "SOW Actual" }),
  ch.accessor("vendor_principle", { header: "Vendor Principle" }),
  ch.accessor("remarks_sow", { header: "Remarks SOW" }),
  ch.accessor("siteid_po", { header: "SiteID PO" }),
  ch.accessor("siteid_act", { header: "SiteID Act" }),
  ch.accessor("nop", { header: "NOP", enableSorting: true }),
  ch.accessor("tp_detail", { header: "TP Detail" }),
  ch.accessor("replan_rfs", { header: "Re-Plan RFS" }),
  ch.accessor("progress_done_flag", {
    header: "FLAG",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (v === "1") return <Badge className="bg-emerald-600 text-white text-[10px]">RFS</Badge>;
      if (v === "x") return <Badge variant="destructive" className="text-[10px]">Drop</Badge>;
      return <Badge variant="secondary" className="text-[10px]">NY</Badge>;
    },
  }),
  ch.accessor("rfs_actual", { header: "RFS Actual" }),
  ch.accessor("rfs_month", { header: "RFS Month", enableSorting: true }),
  ch.accessor("mitra_impl", { header: "Mitra Impl", enableSorting: true }),
  ch.accessor("plan_po", { header: "Plan PO", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("released_po", { header: "Released", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
];

const CHART_COLORS = ["#0ea5e9", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#f59e0b"];

export default function Filter900Page() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [data, setData] = useState<ProjectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState(() => getReportRange("monthly"));
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const baseFilter = { dataset_type: "filter900", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange };
      const [dataRes, sumRes] = await Promise.all([
        projectApi.list({ ...baseFilter, page, limit: LIMIT } as Record<string, string | number>),
        analyticsApi.summary(baseFilter as Record<string, string>),
      ]);
      if (dataRes.success) { setData((dataRes.data as ProjectRecord[]) ?? []); setTotal(dataRes.meta?.total ?? 0); }
      if (sumRes.success && sumRes.data) setSummary(sumRes.data as SummaryResponse);
    } finally { setLoading(false); }
  }, [filters, page, reportRange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters, reportRange]);

  const kpi = summary?.kpi;
  const exportFilters = { dataset_type: "filter900", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange } as Record<string, string>;

  return (
    <AppLayout title="Cloud TI Reeng Kal (Filter)">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Total Filter 900" value={(kpi?.total ?? 0).toLocaleString()} icon={Filter} iconColor="text-sky-600" />
        <KpiCard title="RFS" value={(kpi?.completed ?? 0).toLocaleString()} icon={CheckCircle2} iconColor="text-emerald-600" />
        <KpiCard title="Remaining" value={(kpi?.remaining ?? 0).toLocaleString()} icon={Clock} iconColor="text-amber-600" />
        <KpiCard title="Progress %" value={`${kpi?.progress_pct ?? 0}%`} icon={TrendingUp} iconColor="text-teal-600" />
      </div>

      <ReportRangeFilter value={reportRange} onChange={setReportRange} className="mb-5" />

      {summary && (
        <Tabs defaultValue="overview" className="mb-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="overview">Overview Trend</TabsTrigger>
            <TabsTrigger value="location">NOP Progress</TabsTrigger>
            <TabsTrigger value="partner">Mitra Impl</TabsTrigger>
            <TabsTrigger value="status">Status PO</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ExportableChartCard title="RFS by Month" filename="filter-rfs-by-month.csv" data={summary.charts.by_month}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_month}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="rfs" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="location">
            <ExportableChartCard title="Progress by NOP" filename="filter-progress-by-nop.csv" data={summary.charts.by_nop}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_nop.slice(0, 10)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#06b6d4" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="partner">
            <ExportableChartCard title="Progress by Mitra Impl" filename="filter-progress-by-mitra.csv" data={summary.charts.by_mitra_impl}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_mitra_impl.slice(0, 8)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="status">
            <ExportableChartCard title="Status PO Distribution" filename="filter-status-po.csv" data={summary.charts.by_status_po}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={summary.charts.by_status_po} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={86} label={({ label }) => label} labelLine={false}>
                    {summary.charts.by_status_po.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>
        </Tabs>
      )}

      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{total.toLocaleString()} records</p>
        <div className="flex items-center gap-2">
          <ExportButtons filters={exportFilters} />
          <GlobalFilterDrawer values={filters} onChange={setFilters} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <DataTable columns={COLUMNS} data={data} />
        )}
      </div>

      <div className="mt-2">
        <PaginationBar page={page} totalPages={Math.ceil(total / LIMIT)} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>
    </AppLayout>
  );
}


