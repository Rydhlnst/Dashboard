"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { KpiCard } from "@/components/ui/kpi-card";
import { DataTable } from "@/components/tables/data-table";
import { PaginationBar } from "@/components/tables/pagination-bar";
import { GlobalFilterDrawer, FilterValues } from "@/components/filters/global-filter-drawer";
import { ExportButtons } from "@/components/export/export-buttons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectApi, analyticsApi } from "@/lib/api";
import { ProjectRecord, SummaryResponse } from "@/types/project";
import { ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { DollarSign, TrendingDown, TrendingUp, XCircle } from "lucide-react";

const ch = createColumnHelper<ProjectRecord>();

const fmtCurrency = (v: number | null) =>
  v !== null ? `Rp ${v.toLocaleString("id-ID")}` : "-";

const COLUMNS: ColumnDef<ProjectRecord, unknown>[] = [
  ch.accessor("pono_tsel", { header: "PO Number", enableSorting: true }),
  ch.accessor("po_year", { header: "PO Year" }),
  ch.accessor("project_category", { header: "Project Category" }),
  ch.accessor("vendor_principle", { header: "Vendor Principle" }),
  ch.accessor("status_po", {
    header: "Status PO",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? <Badge variant={v.toLowerCase() === "drop" ? "destructive" : "secondary"}>{v}</Badge> : null;
    },
  }),
  ch.accessor("capex", { header: "Capex", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("price_po", { header: "Price PO", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("price_po_to_be_claim", { header: "Price to Claim", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("price_bast", { header: "Price BAST (Ach)", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("remaining_po", { header: "Remaining PO", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("price_po_presales", { header: "Price Presales", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("wbs_level3", { header: "WBS Level3" }),
  ch.accessor("network_number", { header: "Network Number" }),
  ch.accessor("cid1", { header: "CID-1" }),
  ch.accessor("cid1_price_bast", { header: "CID-1 BAST", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("cid1_creation_date", { header: "CID-1 Create" }),
  ch.accessor("cid1_approve_date", { header: "CID-1 Approve" }),
  ch.accessor("cid2", { header: "CID-2" }),
  ch.accessor("cid2_price_bast", { header: "CID-2 BAST", cell: ({ getValue }) => fmtCurrency(getValue<number | null>()) }),
  ch.accessor("cid2_creation_date", { header: "CID-2 Create" }),
  ch.accessor("cid2_approve_date", { header: "CID-2 Approve" }),
];

const CHART_COLORS = ["#0d9488", "#14b8a6", "#2dd4bf", "#5eead4", "#0891b2", "#06b6d4"];

export default function FinancialPage() {
  const [filters, setFilters] = useState<FilterValues>({});
  const [data, setData] = useState<ProjectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const baseFilter = { dataset_type: "closing", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) };
      const [dataRes, sumRes] = await Promise.all([
        projectApi.list({ ...baseFilter, page, limit: LIMIT } as Record<string, string | number>),
        analyticsApi.summary(baseFilter as Record<string, string>),
      ]);
      if (dataRes.success) { setData((dataRes.data as ProjectRecord[]) ?? []); setTotal(dataRes.meta?.total ?? 0); }
      if (sumRes.success && sumRes.data) setSummary(sumRes.data as SummaryResponse);
    } finally { setLoading(false); }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  const fin = summary?.financial;
  const exportFilters = { dataset_type: "closing", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) } as Record<string, string>;

  return (
    <AppLayout title="PO & Financial">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <KpiCard title="Total Price PO" value={`Rp ${(fin?.total_price_po ?? 0).toLocaleString("id-ID")}`} icon={DollarSign} />
        <KpiCard title="Total to be Claim" value={`Rp ${(fin?.total_claim ?? 0).toLocaleString("id-ID")}`} icon={TrendingUp} iconColor="text-blue-500" />
        <KpiCard title="Total BAST Achieved" value={`Rp ${(fin?.total_bast ?? 0).toLocaleString("id-ID")}`} icon={TrendingUp} iconColor="text-green-500" />
        <KpiCard title="Total Remaining PO" value={`Rp ${(fin?.total_remaining ?? 0).toLocaleString("id-ID")}`} icon={TrendingDown} iconColor="text-red-500" />
      </div>

      {/* Charts */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold mb-3">Count by Project Category</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.charts.by_project_category}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold mb-3">PO Status Distribution</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={summary.charts.by_status_po} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ label }) => label}>
                  {summary.charts.by_status_po.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold mb-3">Count by Vendor Principle</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.charts.by_vendor_principle.slice(0, 10)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="label" type="category" tick={{ fontSize: 10 }} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill="#0891b2" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-sm font-semibold mb-3">RFS by Month</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={summary.charts.by_month}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="rfs" fill="#2dd4bf" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold text-muted-foreground">{total.toLocaleString()} records</p>
        <div className="flex items-center gap-2">
          <ExportButtons filters={exportFilters} />
          <GlobalFilterDrawer values={filters} onChange={setFilters} />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Loading…</div>
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
