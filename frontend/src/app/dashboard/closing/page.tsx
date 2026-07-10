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
import { CheckCircle2, Clock, XCircle, AlertTriangle, TrendingUp, MapPinned, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

const COL_GROUPS = [
  { id: "basic", label: "Basic Info" },
  { id: "site", label: "Site Info" },
  { id: "progress", label: "Progress" },
  { id: "acceptance", label: "ATP/LV/OAC/QC/SQAC/BAUT/BAST" },
  { id: "financial", label: "Financial & PO" },
] as const;

type GroupId = (typeof COL_GROUPS)[number]["id"];

const ch = createColumnHelper<ProjectRecord>();
const CHART_COLORS = ["#16a34a", "#22c55e", "#84cc16", "#a3e635", "#bef264", "#65a30d"];

const BASE_COLS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("pdid", { header: "PDID", enableSorting: true }),
  ch.accessor("po_year", { header: "PO Year", enableSorting: true }),
  ch.accessor("status_po", {
    header: "Status PO",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      const color = v?.toLowerCase() === "drop" ? "destructive" : v?.toLowerCase() === "active" ? "default" : "secondary";
      return v ? <Badge variant={color as "default"}>{v}</Badge> : null;
    },
  }),
  ch.accessor("project_category", { header: "Project Category", enableSorting: true }),
  ch.accessor("sow_actual", { header: "SOW Actual" }),
  ch.accessor("vendor_principle", { header: "Vendor Principle", enableSorting: true }),
];

const SITE_COLS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("siteid_po", { header: "SiteID PO" }),
  ch.accessor("siteid_act", { header: "SiteID Act", enableSorting: true }),
  ch.accessor("neid_act", { header: "NEID Act" }),
  ch.accessor("site_name", { header: "Site Name" }),
  ch.accessor("nop", { header: "NOP", enableSorting: true }),
  ch.accessor("tp_detail", { header: "TP Detail" }),
  ch.accessor("city", { header: "City" }),
  ch.accessor("province", { header: "Province" }),
];

const PROGRESS_COLS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("progress_done_flag", {
    header: "FLAG",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (v === "1") return <Badge className="bg-emerald-600 text-white text-[10px]">RFS</Badge>;
      if (v === "x") return <Badge variant="destructive" className="text-[10px]">Drop</Badge>;
      return <Badge variant="secondary" className="text-[10px]">NY</Badge>;
    },
  }),
  ch.accessor("rfs_actual", { header: "RFS Actual", enableSorting: true }),
  ch.accessor("rfs_month", { header: "RFS Month", enableSorting: true }),
  ch.accessor("mitra_impl", { header: "Mitra Impl" }),
  ch.accessor("issue_category", { header: "Issue Category" }),
  ch.accessor("pic_blocking", { header: "PIC Blocking" }),
  ch.accessor("gap_closing", { header: "Gap Closing" }),
  ch.accessor("current_position", { header: "Current Position" }),
  ch.accessor("status_project", { header: "Status Project" }),
  ch.accessor("progress_closing", { header: "Progress Closing" }),
  ch.accessor("sub_progress_closing", { header: "Sub Progress Closing" }),
];

const ACCEPTANCE_COLS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("atp_status", { header: "ATP Status" }),
  ch.accessor("atp_blocking", { header: "ATP Blocking" }),
  ch.accessor("atp_approved", { header: "ATP Approved" }),
  ch.accessor("lv_status", { header: "LV Status" }),
  ch.accessor("lv_blocking", { header: "LV Blocking" }),
  ch.accessor("elv_approved", { header: "eLV Approved" }),
  ch.accessor("oac_status", { header: "OAC Status" }),
  ch.accessor("oac_blocking", { header: "OAC Blocking" }),
  ch.accessor("oac_approved", { header: "OAC Approved" }),
  ch.accessor("qc_status", { header: "QC Status" }),
  ch.accessor("qc_blocking", { header: "QC Blocking" }),
  ch.accessor("qc_sign", { header: "QC Sign" }),
  ch.accessor("sqac_status", { header: "SQAC Status" }),
  ch.accessor("sqac_approved", { header: "SQAC Approved" }),
  ch.accessor("baut_status", { header: "BAUT Status" }),
  ch.accessor("baut_approved", { header: "BAUT Approved" }),
  ch.accessor("bast_status", { header: "BAST Status" }),
  ch.accessor("bast_approved", { header: "BAST Approved" }),
];

const FINANCIAL_COLS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("pono_tsel", { header: "PoNo Tsel" }),
  ch.accessor("capex", { header: "Capex" }),
  ch.accessor("price_po", { header: "Price PO", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("price_po_to_be_claim", { header: "Price to Claim", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("price_bast", { header: "Price BAST", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("remaining_po", { header: "Remaining PO", cell: ({ getValue }) => getValue<number | null>()?.toLocaleString("id-ID") ?? "-" }),
  ch.accessor("wbs_level3", { header: "WBS Level3" }),
  ch.accessor("network_number", { header: "Network Number" }),
  ch.accessor("cid1", { header: "CID-1" }),
  ch.accessor("cid2", { header: "CID-2" }),
];

const GROUP_COLS: Record<GroupId, ColumnDef<ProjectRecord, unknown>[]> = {
  basic: BASE_COLS,
  site: SITE_COLS,
  progress: PROGRESS_COLS,
  acceptance: ACCEPTANCE_COLS,
  financial: FINANCIAL_COLS,
};

export default function ClosingPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [activeGroup, setActiveGroup] = useState<GroupId>("basic");
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
      const baseFilter = { dataset_type: "closing", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange };
      const [dataRes, kpiRes] = await Promise.all([
        projectApi.list({ ...baseFilter, page, limit: LIMIT } as Record<string, string | number>),
        analyticsApi.summary(baseFilter as Record<string, string>),
      ]);

      if (dataRes.success) {
        setData((dataRes.data as ProjectRecord[]) ?? []);
        setTotal(dataRes.meta?.total ?? 0);
      }
      if (kpiRes.success && kpiRes.data) {
        setSummary(kpiRes.data as SummaryResponse);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, page, reportRange]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters, reportRange]);

  const kpi = summary?.kpi;
  const exportFilters = { dataset_type: "closing", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)), ...reportRange } as Record<string, string>;

  return (
    <AppLayout title="Cloud TI Reeng Kal (Closing)" adminOnly={false}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-5">
        <KpiCard title="Total Sites" value={(kpi?.total ?? 0).toLocaleString()} icon={MapPinned} iconColor="text-sky-600" />
        <KpiCard title="RFS / Completed" value={(kpi?.completed ?? 0).toLocaleString()} icon={CheckCircle2} iconColor="text-emerald-600" />
        <KpiCard title="NY / Remaining" value={(kpi?.remaining ?? 0).toLocaleString()} icon={Clock} iconColor="text-amber-600" />
        <KpiCard title="Dropped" value={(kpi?.dropped ?? 0).toLocaleString()} icon={XCircle} iconColor="text-rose-600" />
        <KpiCard title="Progress %" value={`${kpi?.progress_pct ?? 0}%`} icon={TrendingUp} iconColor="text-teal-600" />
        <KpiCard title="Issues" value={(kpi?.issues ?? 0).toLocaleString()} icon={AlertTriangle} iconColor="text-orange-600" />
      </div>

      <ReportRangeFilter value={reportRange} onChange={setReportRange} className="mb-5" />

      {summary && (
        <Tabs defaultValue="overview" className="mb-5">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="overview">Overview Trend</TabsTrigger>
            <TabsTrigger value="issues">Issue Category</TabsTrigger>
            <TabsTrigger value="location">NOP Progress</TabsTrigger>
            <TabsTrigger value="partner">Mitra Impl</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ExportableChartCard title="RFS vs Remaining by Month" filename="closing-rfs-by-month.csv" data={summary.charts.by_month}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_month}>
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="rfs" fill="#16a34a" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="ny" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="issues">
            <ExportableChartCard title="Issues by Category" filename="closing-issues-by-category.csv" data={summary.charts.by_issue_category}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_issue_category.slice(0, 10)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#f97316" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="location">
            <ExportableChartCard title="Progress by NOP" filename="closing-progress-by-nop.csv" data={summary.charts.by_nop}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.charts.by_nop.slice(0, 10)} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#0284c7" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ExportableChartCard>
          </TabsContent>

          <TabsContent value="partner">
            <ExportableChartCard title="Mitra Implementation Distribution" filename="closing-mitra-implementation.csv" data={summary.charts.by_mitra_impl}>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={summary.charts.by_mitra_impl.slice(0, 6)} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={86} label={({ label }) => label}>
                    {summary.charts.by_mitra_impl.slice(0, 6).map((_, i) => (
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
        <div className="flex items-center gap-1 flex-wrap">
          {COL_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGroup(g.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                activeGroup === g.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <ExportButtons filters={exportFilters} />
          <GlobalFilterDrawer values={filters} onChange={setFilters} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <DataTable columns={GROUP_COLS[activeGroup]} data={data} />
        )}
      </div>

      <div className="mt-2">
        <PaginationBar
          page={page}
          totalPages={Math.ceil(total / LIMIT)}
          total={total}
          limit={LIMIT}
          onPageChange={setPage}
        />
      </div>
    </AppLayout>
  );
}


