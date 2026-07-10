"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import { datasetsApi } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Loader2, Search, ChevronLeft, ChevronRight, DatabaseZap,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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

export default function DatasetDetailPage() {
  const params   = useParams();
  const id       = Number(params.id);

  const [dataset, setDataset]   = useState<Dataset | null>(null);
  const [rows, setRows]         = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta]         = useState<Meta | null>(null);
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(50);
  const [search, setSearch]     = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading]   = useState(true);
  const [sortCol, setSortCol]   = useState("");
  const [sortDir, setSortDir]   = useState<"asc"|"desc">("asc");

  const load = useCallback(async (p: number, s: string, sc: string, sd: string) => {
    setLoading(true);
    try {
      const res = await datasetsApi.query({ dataset_id: id, page: p, limit, search: s || undefined, sort_col: sc || undefined, sort_dir: sd });
      if (res.success) {
        const d = res.data as { dataset: Dataset; rows: Record<string, unknown>[]; meta: Meta };
        setDataset(d.dataset);
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
  }, [id, limit]);

  useEffect(() => { load(page, search, sortCol, sortDir); }, [load, page, search, sortCol, sortDir]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setSearch(searchInput);
  }, [searchInput]);

  const handleSort = useCallback((col: string) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(1);
  }, [sortCol]);

  // Columns to display (user cols only, skip _id / _batch_id / _imported_at)
  const visibleCols = dataset?.schema ?? [];

  return (
    <AppLayout>
      <div className="max-w-full px-4 py-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
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
              {meta && (
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                  {meta.total.toLocaleString()} rows
                </span>
              )}
            </>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
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
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={visibleCols.length + 1} className="text-center py-12 text-muted-foreground">
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
          <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
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
      </div>
    </AppLayout>
  );
}
