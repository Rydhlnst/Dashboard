"use client";

import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { projectApi } from "@/lib/api";
import { ProjectRecord } from "@/types/project";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KpiCard } from "@/components/ui/kpi-card";
import { PaginationBar } from "@/components/tables/pagination-bar";
import { toast } from "sonner";
import { AlertTriangle, ShieldAlert, CheckCircle2, Clock, RefreshCw, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

type Severity = "Critical" | "Warning" | "Normal" | "Done";

function getSeverity(row: ProjectRecord): Severity {
  if (row.rfs_actual) return "Done";
  const hasAccBlocking = [
    row.atp_blocking, row.lv_blocking, row.oac_blocking, row.qc_blocking,
    row.sqac_blocking, row.baut_blocking, row.bast_blocking,
  ].some(Boolean);
  if (row.blocking && !row.rfs_actual) return "Critical";
  if (hasAccBlocking) return "Warning";
  return "Normal";
}

const SEVERITY_CONFIG: Record<Severity, { label: string; cls: string }> = {
  Critical: { label: "Critical", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  Warning: { label: "Warning", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  Normal: { label: "Normal", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  Done: { label: "Done", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
};

function SeverityBadge({ sev }: { sev: Severity }) {
  const cfg = SEVERITY_CONFIG[sev];
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>{cfg.label}</span>;
}

const BLOCKING_FIELDS: Array<{ key: keyof ProjectRecord; label: string }> = [
  { key: "atp_blocking", label: "ATP" },
  { key: "lv_blocking", label: "LV" },
  { key: "oac_blocking", label: "OAC" },
  { key: "qc_blocking", label: "QC" },
  { key: "sqac_blocking", label: "SQAC" },
  { key: "baut_blocking", label: "BAUT" },
  { key: "bast_blocking", label: "BAST" },
];

const PAGE_SIZE = 30;

export default function IssuesPage() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<ProjectRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");

  const fetchData = async () => {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: Record<string, unknown> = { limit: PAGE_SIZE, page, blocking: 1 };
      if (search) params.search = search;
      const res = await projectApi.list(params as Record<string, string | number>) as {
        success: boolean;
        data: ProjectRecord[];
        meta: { total: number; total_pages: number };
      };
      if (res.success) {
        setRecords(res.data);
        setTotal(res.meta.total);
      }
    } catch {
      toast.error("Failed to load issues.");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [page, search]);

  const handleSearch = () => { setSearch(searchInput.trim()); setPage(1); };

  // Filtered by severity (client-side)
  const filtered = severity
    ? records.filter((r) => getSeverity(r) === severity)
    : records;

  // Computed counts
  const counts = records.reduce(
    (acc, r) => { acc[getSeverity(r)]++; return acc; },
    { Critical: 0, Warning: 0, Normal: 0, Done: 0 } as Record<Severity, number>
  );

  // PIC Blocking chart data
  const picMap: Record<string, number> = {};
  records.forEach((r) => { if (r.pic_blocking) picMap[r.pic_blocking] = (picMap[r.pic_blocking] ?? 0) + 1; });
  const picData = Object.entries(picMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  // Acceptance blocking process chart
  const procData = BLOCKING_FIELDS.map(({ key, label }) => ({
    name: label,
    count: records.filter((r) => r[key]).length,
  })).filter((d) => d.count > 0);

  return (
    <AppLayout title="Issue & Blocking">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold">Issue & Blocking Monitoring</p>
          <p className="text-xs text-muted-foreground">Track site blocking and acceptance issues across all datasets</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading} className="gap-1.5 h-8">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <KpiCard
          title="Critical"
          value={loading ? "…" : String(counts.Critical)}
          icon={ShieldAlert}
          iconColor="text-red-500"
          subtitle="Blocking + no RFS"
        />
        <KpiCard
          title="Warning"
          value={loading ? "…" : String(counts.Warning)}
          icon={AlertTriangle}
          iconColor="text-amber-500"
          subtitle="Acceptance blocking"
        />
        <KpiCard
          title="Normal"
          value={loading ? "…" : String(counts.Normal)}
          icon={Clock}
          iconColor="text-blue-500"
          subtitle="Issue category only"
        />
        <KpiCard
          title="Done / RFS"
          value={loading ? "…" : String(counts.Done)}
          icon={CheckCircle2}
          iconColor="text-green-500"
          subtitle="Has RFS actual"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Blocking by PIC</p>
          <div className="h-40">
            {picData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={picData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
            )}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Blocking by Acceptance Process</p>
          <div className="h-40">
            {procData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={procData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No data</div>
            )}
          </div>
        </div>
      </div>

      {/* Table Filters */}
      <div className="bg-card rounded-xl border border-border p-3 mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-48">
          <Input
            placeholder="Search site name, PDID…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-8 px-2.5">
            <Search size={13} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {(["", "Critical", "Warning", "Normal", "Done"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverity(s)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                severity === s
                  ? "bg-teal-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {s === "" ? "All" : s}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">
          {loading ? "Loading…" : `${total} total blocking records`}
        </span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">Severity</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Site Name</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">PDID</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Issue Category</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">PIC Blocking</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Mitra</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">ATP</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">LV</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">OAC</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">QC</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">SQAC</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">BAUT</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">BAST</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Support Needed</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-10 text-center text-muted-foreground">No blocking records found.</td></tr>
            ) : (
              filtered.map((row) => {
                const sev = getSeverity(row);
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap"><SeverityBadge sev={sev} /></td>
                    <td className="px-3 py-2 font-medium max-w-36 truncate">{row.site_name ?? "-"}</td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{row.pdid ?? "-"}</td>
                    <td className="px-3 py-2 max-w-36 truncate">{row.issue_category ?? "-"}</td>
                    <td className="px-3 py-2">{row.pic_blocking ?? "-"}</td>
                    <td className="px-3 py-2">{row.mitra_impl ?? "-"}</td>
                    {BLOCKING_FIELDS.map(({ key }) => (
                      <td key={key} className="px-3 py-2">
                        {row[key] ? (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 font-normal">
                            {String(row[key]).slice(0, 20)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-2 max-w-40 truncate text-muted-foreground" title={row.support_needed ?? ""}>
                      {row.support_needed ?? "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <PaginationBar
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          limit={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </AppLayout>
  );
}
