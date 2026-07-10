"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { datasetsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { getStoredUser } from "@/lib/auth";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { DatabaseZap, Trash2, Eye, Upload, Loader2, Calendar, Columns3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Dataset {
  id: number;
  name: string;
  slug: string;
  table_name: string;
  primary_key_col: string | null;
  column_count: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DatasetsPage() {
  const user = getStoredUser();
  const isSuperAdmin = user?.role === "super_admin";

  const [datasets, setDatasets]   = useState<Dataset[]>([]);
  const [loading, setLoading]     = useState(true);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await datasetsApi.list();
      if (res.success) {
        setDatasets((res.data as any).datasets ?? []);
      }
    } catch {
      toast.error("Failed to load datasets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await datasetsApi.delete(deleteId);
      if (res.success) {
        toast.success("Dataset deleted.");
        setDatasets(prev => prev.filter(d => d.id !== deleteId));
      } else {
        toast.error(res.message || "Delete failed.");
      }
    } catch {
      toast.error("Delete failed.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }, [deleteId]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dynamic Datasets</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tables auto-created from imported Excel / CSV files.
            </p>
          </div>
          <Link href="/dashboard/import">
            <Button size="sm">
              <Upload size={14} className="mr-2" /> Import New
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : datasets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 flex flex-col items-center gap-3 text-center">
            <DatabaseZap size={36} className="text-muted-foreground/30" />
            <p className="font-medium text-sm text-muted-foreground">No datasets yet</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs">
              Import an Excel or CSV file and a dedicated table will be created automatically.
            </p>
            <Link href="/dashboard/import">
              <Button size="sm" variant="outline" className="mt-2">
                <Upload size={13} className="mr-2" /> Import First Dataset
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {datasets.map(ds => (
              <div
                key={ds.id}
                className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <DatabaseZap size={15} className="text-teal-500 shrink-0" />
                    <h2 className="font-semibold text-sm truncate">{ds.name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span className="font-mono text-[10px] bg-muted/50 px-2 py-0.5 rounded">{ds.table_name}</span>
                    <span className="flex items-center gap-1">
                      <Columns3 size={10} /> {ds.column_count} columns
                    </span>
                    <span className="tabular-nums font-medium">
                      {ds.row_count.toLocaleString()} rows
                    </span>
                    {ds.primary_key_col && (
                      <span className="text-teal-600 dark:text-teal-400">
                        PK: {ds.primary_key_col}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar size={10} /> {formatDate(ds.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/dashboard/datasets/${ds.id}`}>
                    <Button size="sm" variant="outline">
                      <Eye size={13} className="mr-1.5" /> View Data
                    </Button>
                  </Link>
                  <Link href={`/dashboard/import`}>
                    <Button size="sm" variant="outline">
                      <Upload size={13} className="mr-1.5" /> Re-import
                    </Button>
                  </Link>
                  {isSuperAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDeleteId(ds.id)}
                      className="text-red-500 hover:text-red-600 hover:border-red-300"
                    >
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dataset</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently drop the table and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 size={14} className="mr-2 animate-spin" /> : null}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
