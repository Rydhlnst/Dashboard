"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { projectApi } from "@/lib/api";
import { ProjectRecord } from "@/types/project";
import { toast } from "sonner";
import {
  FileCheck, ShieldCheck, CheckCircle2, AlertTriangle, Eye, Loader2,
  RefreshCw, Layers, CheckSquare, Clock
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const STAGES = [
  { key: "atp_status", label: "ATP (Acceptance Test Procedure)" },
  { key: "lv_status", label: "LV (Line Verification)" },
  { key: "oac_status", label: "OAC (Operational Acceptance Certificate)" },
  { key: "qc_status", label: "QC (Quality Control)" },
  { key: "sqac_status", label: "SQAC (Site Quality Acceptance Certificate)" },
  { key: "baut_status", label: "BAUT (Berita Acara Uji Terima)" },
  { key: "bast_status", label: "BAST (Berita Acara Serah Terima)" },
];

const COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af", "#1e3a8a", "#0f172a", "#020617"
];

export default function AcceptanceDashboardPage() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail dialog
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailRecord, setDetailRecord] = useState<ProjectRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchAcceptanceData = async () => {
    setLoading(true);
    try {
      // Fetch up to 1000 sites for analysis
      const res: any = await projectApi.list({ limit: 1000 });
      if (res.success) {
        setProjects(res.data);
      }
    } catch {
      toast.error("Gagal memuat data acceptance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAcceptanceData();
  }, []);

  const openDetail = async (id: number) => {
    setDetailId(id);
    setLoadingDetail(true);
    setDetailRecord(null);
    try {
      const res: any = await projectApi.get(id);
      if (res.success) {
        setDetailRecord(res.data);
      } else {
        toast.error(res.message);
        setDetailId(null);
      }
    } catch {
      toast.error("Gagal memuat detail project.");
      setDetailId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const isDone = (status: string | null) => {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes("done") || s.includes("approve") || s.includes("complete") || s.includes("selesai") || s.includes("ya") || s === "1";
  };

  const parseNumber = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const num = parseFloat(String(val));
    return isNaN(num) ? 0 : num;
  };

  // Calculations
  const getStageCounts = () => {
    return STAGES.map((stage) => {
      const doneCount = projects.filter((p) => isDone(p[stage.key as keyof ProjectRecord] as string)).length;
      return {
        name: stage.label.split(" (")[0], // Short name
        fullName: stage.label,
        key: stage.key,
        done: doneCount,
        pending: projects.length - doneCount,
      };
    });
  };

  const stageCounts = getStageCounts();
  const nonBastProjects = projects.filter((p) => !isDone(p.bast_status));

  return (
    <AppLayout title="Acceptance Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center flex-wrap gap-2 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Site Acceptance Tracker</h2>
            <p className="text-xs text-muted-foreground">Lacak pencapaian milestone per tahapan dari ATP hingga BAST.</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchAcceptanceData} disabled={loading} className="gap-2">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </Button>
        </div>

        {/* Stages KPIs Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {stageCounts.map((s, idx) => (
            <Card key={idx} className="shadow-sm border-muted/60 bg-card/50">
              <CardContent className="p-3 text-center flex flex-col justify-between h-full space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide truncate block">{s.name}</span>
                <div className="py-1">
                  <p className="text-xl font-extrabold font-mono text-primary">
                    {loading ? <span className="h-6 w-8 bg-muted animate-pulse rounded inline-block" /> : s.done}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Done</p>
                </div>
                <div className="border-t pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><Clock size={10} /> {s.pending}</span>
                  <span className="font-bold text-green-600">
                    {projects.length > 0 ? `${Math.round((s.done / projects.length) * 100)}%` : "0%"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Funnel & Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Funnel Chart Card */}
          <Card className="lg:col-span-8 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Layers className="text-blue-500" size={18} />
                Acceptance Funnel (Milestone Progress)
              </CardTitle>
              <CardDescription className="text-xs">
                Grafik perbandingan penyelesaian tiap tahapan site rollout (milestone).
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px] flex items-center justify-center">
                {loading ? (
                  <Loader2 className="animate-spin text-muted-foreground" size={24} />
                ) : projects.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stageCounts} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={70} />
                      <Tooltip formatter={(value) => [`${value} Sites`, "Selesai"]} />
                      <Bar dataKey="done" radius={[0, 4, 4, 0]}>
                        {stageCounts.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-xs text-muted-foreground">Tidak ada data</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats Summary */}
          <Card className="lg:col-span-4 shadow-sm">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="text-green-500" size={18} />
                Milestone Summary
              </CardTitle>
              <CardDescription className="text-xs">Rangkuman pencapaian serah terima</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Total Sites Terdaftar</span>
                <span className="font-bold text-sm font-mono">{projects.length}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">BAUT Done (Siap BAST)</span>
                <span className="font-bold text-sm font-mono text-blue-600">
                  {projects.filter(p => isDone(p.baut_status)).length} Site
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">BAST Done (Closed / Handover)</span>
                <span className="font-bold text-sm font-mono text-green-600">
                  {projects.filter(p => isDone(p.bast_status)).length} Site
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Handover Rate</span>
                <span className="font-bold text-sm text-green-600">
                  {projects.length > 0 
                    ? `${((projects.filter(p => isDone(p.bast_status)).length / projects.length) * 100).toFixed(1)}%` 
                    : "0.0%"}
                </span>
              </div>

              {/* Progress bar of Handover */}
              <div className="pt-2">
                <Progress 
                  value={projects.length > 0 ? (projects.filter(p => isDone(p.bast_status)).length / projects.length) * 100 : 0} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Non-BAST Sites Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <CheckSquare className="text-yellow-600" size={18} />
              Daftar Project Belum BAST (Outstanding Handover)
            </CardTitle>
            <CardDescription className="text-xs">
              Daftar site rollout yang belum menyelesaikan serah terima akhir (BAST Status is pending/outstanding).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-semibold w-16">ID</TableHead>
                    <TableHead className="font-semibold">Site Name</TableHead>
                    <TableHead className="font-semibold">BAUT Status</TableHead>
                    <TableHead className="font-semibold">BAST Status</TableHead>
                    <TableHead className="font-semibold">Mitra Impl</TableHead>
                    <TableHead className="font-semibold w-40">Progress Closing</TableHead>
                    <TableHead className="font-semibold w-24 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j} className="py-4">
                            <div className="h-4 bg-muted animate-pulse rounded w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : !nonBastProjects.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-12 text-center text-muted-foreground text-xs">
                        Hebat! Semua site sudah 100% serah terima (BAST).
                      </TableCell>
                    </TableRow>
                  ) : (
                    nonBastProjects.slice(0, 50).map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/10">
                        <TableCell className="text-xs text-muted-foreground">{row.id}</TableCell>
                        <TableCell className="font-semibold">{row.site_name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={isDone(row.baut_status) ? "success" : "outline"}>
                            {row.baut_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isDone(row.bast_status) ? "success" : "outline"} className="text-yellow-600 dark:text-yellow-400 border-yellow-200">
                            {row.bast_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell>{row.mitra_impl || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={parseNumber(row.progress_closing)} className="h-2 w-16" />
                            <span className="text-xs font-mono font-bold">
                              {row.progress_closing !== null ? `${row.progress_closing}%` : "0%"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openDetail(row.id)}>
                            <Eye size={14} />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Row Detail Dialog */}
      <Dialog open={detailId !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="text-blue-500" size={20} />
              Detail Status Acceptance: {detailRecord?.site_name || "Memuat..."}
            </DialogTitle>
            <DialogDescription>
              Detail milestone dan sertifikasi terima site rollout.
            </DialogDescription>
          </DialogHeader>

          {loadingDetail && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-primary" size={40} />
            </div>
          )}

          {detailRecord && (
            <div className="space-y-6 pt-4 text-xs">
              {/* Category 1: Identifiers */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-primary uppercase tracking-wide border-b pb-1">Identifiers</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><span className="text-muted-foreground block">PDID</span><p className="font-mono font-medium">{detailRecord.pdid || "-"}</p></div>
                  <div><span className="text-muted-foreground block">CAID</span><p className="font-mono font-medium">{detailRecord.caid || "-"}</p></div>
                  <div><span className="text-muted-foreground block">Site Name</span><p className="font-medium">{detailRecord.site_name || "-"}</p></div>
                  <div><span className="text-muted-foreground block">Mitra Impl</span><p className="font-medium">{detailRecord.mitra_impl || "-"}</p></div>
                </div>
              </div>

              {/* Category 2: Detailed Stage List */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-primary uppercase tracking-wide border-b pb-1">Acceptance Milestone Checklist</h3>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow>
                        <TableHead className="font-bold w-12 text-center">No</TableHead>
                        <TableHead className="font-bold">Tahapan / Milestone</TableHead>
                        <TableHead className="font-bold w-48">Status / Nilai</TableHead>
                        <TableHead className="font-bold w-32 text-center">Status Akhir</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y">
                      {STAGES.map((s, idx) => {
                        const val = detailRecord[s.key as keyof ProjectRecord] as string | null;
                        const done = isDone(val);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="text-center font-semibold">{idx + 1}</TableCell>
                            <TableCell className="font-medium">{s.label}</TableCell>
                            <TableCell className="font-mono">{val || "-"}</TableCell>
                            <TableCell className="text-center">
                              {done ? (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200">Done</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground/60">Pending</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Category 3: Progress & Closings */}
              <div className="space-y-2">
                <h3 className="font-bold text-sm text-primary uppercase tracking-wide border-b pb-1">Closing & Verification Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded p-3 text-center">
                    <span className="text-muted-foreground block mb-1">Progress Closing Rate</span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <Progress value={parseNumber(detailRecord.progress_closing)} className="h-2 w-20" />
                      <span className="font-bold font-mono text-sm">{detailRecord.progress_closing || 0}%</span>
                    </div>
                  </div>
                  <div className="border rounded p-3 text-center">
                    <span className="text-muted-foreground block mb-1">Sub Progress Closing</span>
                    <span className="font-bold text-sm">{detailRecord.sub_progress_closing || "-"}</span>
                  </div>
                  <div className="border rounded p-3 text-center">
                    <span className="text-muted-foreground block mb-1">Current Position</span>
                    <span className="font-semibold text-sm">{detailRecord.current_position || "-"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3">
            <Button onClick={() => setDetailId(null)}>Tutup Detail</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </AppLayout>
  );
}
