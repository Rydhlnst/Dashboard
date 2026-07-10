"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { auditLogApi } from "@/lib/api";
import { AuditLog } from "@/types/column";
import { PaginationBar } from "@/components/tables/pagination-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { History } from "lucide-react";
import { format } from "date-fns";

const ACTION_COLORS: Record<string, string> = {
  login: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  logout: "bg-gray-100 text-gray-600 dark:bg-gray-800",
  create: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  update: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  delete: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  import: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  export_csv: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  export_excel: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] ?? "bg-muted text-muted-foreground";
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{action}</span>;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditLogApi.list({
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        limit: LIMIT,
      });
      if (res.success) {
        setLogs((res.data as AuditLog[]) ?? []);
        setTotal(res.meta?.total ?? 0);
      }
    } finally { setLoading(false); }
  }, [search, dateFrom, dateTo, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  return (
    <AppLayout title="Audit Log" adminOnly>
      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Action, user, description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs mt-1 w-56"
          />
        </div>
        <div>
          <Label className="text-xs">Date From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs mt-1 w-36" />
        </div>
        <div>
          <Label className="text-xs">Date To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs mt-1 w-36" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">Timestamp</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">User</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Action</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Entity</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Entity ID</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Description</th>
              <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No audit logs found.</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {log.created_at ? format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss") : "-"}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{log.user_name ?? "System"}</p>
                    <p className="text-muted-foreground text-[10px]">{log.user_email}</p>
                  </td>
                  <td className="px-3 py-2"><ActionBadge action={log.action} /></td>
                  <td className="px-3 py-2 text-muted-foreground">{log.entity}</td>
                  <td className="px-3 py-2 text-muted-foreground">{log.entity_id}</td>
                  <td className="px-3 py-2 text-muted-foreground max-w-xs truncate" title={log.description ?? ""}>
                    {log.description}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{log.ip_address}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-2">
        <PaginationBar page={page} totalPages={Math.ceil(total / LIMIT)} total={total} limit={LIMIT} onPageChange={setPage} />
      </div>
    </AppLayout>
  );
}
