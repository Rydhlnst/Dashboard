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
import { Swords, DollarSign, BarChart3, ReceiptText } from "lucide-react";

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
  ch.accessor("capex", { header: "Capex" }),
  ch.accessor("band", { header: "Band" }),
  ch.accessor("sector", { header: "Sector" }),
  ch.accessor("project_category", { header: "Project Category", enableSorting: true }),
  ch.accessor("sow_actual", { header: "SOW Actual", enableSorting: true }),
  ch.accessor("vendor_principle", { header: "Vendor Principle", enableSorting: true }),
  ch.accessor("plan_po", { header: "Plan PO", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("released_po", { header: "Released", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
];

const CHART_COLORS = ["#7c3aed", "#a855f7", "#ec4899", "#f97316", "#f59e0b", "#22c55e", "#06b6d4"];

export default function RefinementPage() {
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
      const baseFilter = { dataset_type: "refinement", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange };
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
  const exportFilters = { dataset_type: "refinement", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange } as Record<string, string>;

  return (
    <AppLayout title="Cloud TI Reeng Kal (Refinement)">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Total Data" value={(kpi?.total ?? 0).toLocaleString()} icon={Swords} iconColor="text-violet-600" />
        <KpiCard title="Total Financial PO" value={`Rp ${(summary?.financial.total_price_po ?? 0).toLocaleString("id-ID")}`} icon={DollarSign} iconColor="text-emerald-600" />
        <KpiCard title="Released" value={`Rp ${(summary?.financial.total_bast ?? 0).toLocaleString("id-ID")}`} icon={ReceiptText} iconColor="text-teal-600" />
        <KpiCard title="Plan PO vs Released" value={`${kpi?.progress_pct ?? 0}%`} icon={BarChart3} iconColor="text-sky-600" />
      </div>

      <ReportRangeFilter value={reportRange} onChange={setReportRange} className="mb-5" />

      {summary && (
        <Tabs defaultValue="category" className="mb-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="category">Project Category</TabsTrigger>
            <TabsTrigger value="partner">Mitra Impl</TabsTrigger>
            <TabsTrigger value="vendor">Vendor Principle</TabsTrigger>
            <TabsTrigger value="status">Status PO</TabsTrigger>
          </TabsList>

          <TabsContent value="category">
            <ExportableChartCard title="Data by Project Category" filename="refinement-project-category.csv" data={summary.charts.by_project_category}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.charts.by_project_category}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#7c3aed" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="partner">
            <ExportableChartCard title="Data by Mitra Impl" filename="refinement-mitra-impl.csv" data={summary.charts.by_mitra_impl}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.charts.by_mitra_impl.slice(0, 10)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#a855f7" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="vendor">
            <ExportableChartCard title="Vendor Principle Distribution" filename="refinement-vendor-principle.csv" data={summary.charts.by_vendor_principle}>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={summary.charts.by_vendor_principle.slice(0, 6)} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label }) => label}>
                    {summary.charts.by_vendor_principle.slice(0, 6).map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="status">
            <ExportableChartCard title="Status PO Distribution" filename="refinement-status-po.csv" data={summary.charts.by_status_po}>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={summary.charts.by_status_po}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[3, 3, 0, 0]} />
                </BarChart>
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


