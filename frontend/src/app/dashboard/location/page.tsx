"use client";

import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { projectApi, analyticsApi } from "@/lib/api";
import { ProjectRecord } from "@/types/project";
import { toast } from "sonner";
import { RefreshCw, MapPin, ShieldAlert, Loader2, Globe } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import of Leaflet Map component to prevent Next.js SSR window is not defined errors
const MapComponent = dynamic(
  () => import("@/components/location/map-component").then((mod) => ({ default: mod.default })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] w-full bg-muted/30 border rounded-lg flex flex-col items-center justify-center space-y-2">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-xs text-muted-foreground font-semibold">Memuat Peta...</p>
      </div>
    ),
  }
);


interface FilterOptions {
  provinces: string[];
  statusProjects: string[];
  mitras: string[];
  categories: string[];
}

export default function LocationMapDashboard() {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats
  const [totalMapped, setTotalMapped] = useState(0);
  const [totalUnmapped, setTotalUnmapped] = useState(0);

  // Filters dropdown
  const [filterOpts, setFilterOpts] = useState<FilterOptions>({
    provinces: [],
    statusProjects: [],
    mitras: [],
    categories: [],
  });

  const [selectedFilters, setSelectedFilters] = useState({
    province: "",
    status_project: "",
    mitra_impl: "",
    issue_category: "",
  });

  // Fetch filter options on mount
  useEffect(() => {
    analyticsApi.summary().then((res: any) => {
      if (res.success) {
        const s = res.data;
        setFilterOpts({
          provinces: (s.by_province || []).map((x: any) => x.label),
          statusProjects: (s.by_status_project || []).map((x: any) => x.label),
          mitras: (s.by_mitra_impl || []).map((x: any) => x.label),
          categories: (s.by_issue_category || []).map((x: any) => x.label),
        });
      }
    });
  }, []);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {
        limit: 500, // Safe threshold for map rendering
      };

      Object.entries(selectedFilters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });

      const res: any = await projectApi.list(params);
      if (res.success) {
        const list = res.data as ProjectRecord[];
        setProjects(list);

        const mapped = list.filter((p) => p.lat !== null && p.lng !== null).length;
        setTotalMapped(mapped);
        setTotalUnmapped(list.length - mapped);
      }
    } catch {
      toast.error("Gagal memuat titik koordinat site.");
    } finally {
      setLoading(false);
    }
  }, [selectedFilters]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const handleFilterChange = (key: string, value: string) => {
    setSelectedFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleReset = () => {
    setSelectedFilters({
      province: "",
      status_project: "",
      mitra_impl: "",
      issue_category: "",
    });
    toast.success("Filter peta dibersihkan.");
  };

  return (
    <AppLayout title="Location Map">
      <div className="space-y-6 max-w-7xl mx-auto">
        
        {/* Header Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card border p-4 rounded-lg shadow-sm">
          <div className="flex flex-wrap gap-2 flex-1 min-w-[280px]">
            {/* Province Filter */}
            <Select value={selectedFilters.province} onValueChange={(v) => handleFilterChange("province", v)}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Provinsi" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">Semua Provinsi</SelectItem>
                {filterOpts.provinces.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Project */}
            <Select value={selectedFilters.status_project} onValueChange={(v) => handleFilterChange("status_project", v)}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Status Project" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">Semua Status</SelectItem>
                {filterOpts.statusProjects.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mitra Impl */}
            <Select value={selectedFilters.mitra_impl} onValueChange={(v) => handleFilterChange("mitra_impl", v)}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Mitra" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">Semua Mitra</SelectItem>
                {filterOpts.mitras.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Issue Category */}
            <Select value={selectedFilters.issue_category} onValueChange={(v) => handleFilterChange("issue_category", v)}>
              <SelectTrigger className="h-9 w-40 text-xs"><SelectValue placeholder="Kendala" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="" className="text-xs">Semua Kendala</SelectItem>
                {filterOpts.categories.filter(Boolean).map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} className="h-9 text-xs">Reset</Button>
            <Button variant="outline" size="sm" onClick={fetchSites} disabled={loading} className="h-9">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Mapped Sites (Valid GPS)</p>
                <p className="text-2xl font-bold font-mono text-green-600 mt-0.5">
                  {loading ? <span className="h-6 w-10 bg-muted animate-pulse rounded inline-block" /> : totalMapped}
                </p>
              </div>
              <div className="p-2 rounded-full bg-green-500/10 text-green-500"><MapPin size={18} /></div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Unmapped Sites (No GPS)</p>
                <p className="text-2xl font-bold font-mono text-yellow-600 mt-0.5">
                  {loading ? <span className="h-6 w-10 bg-muted animate-pulse rounded inline-block" /> : totalUnmapped}
                </p>
              </div>
              <div className="p-2 rounded-full bg-yellow-500/10 text-yellow-500"><Globe size={18} /></div>
            </CardContent>
          </Card>
        </div>

        {/* Map View Card */}
        <Card className="shadow-sm overflow-hidden flex flex-col">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Globe className="text-blue-500" size={18} />
              Geographical Rollout Sites
            </CardTitle>
            <CardDescription className="text-xs">
              Peta koordinat sebaran site rollout seluruh Indonesia. Klik penanda (marker) untuk melihat informasi detail site.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 h-[480px] w-full">
            {loading ? (
              <div className="h-full w-full bg-muted/20 animate-pulse flex flex-col items-center justify-center space-y-2">
                <Loader2 className="animate-spin text-primary" size={32} />
                <p className="text-xs text-muted-foreground font-semibold">Memuat data koordinat...</p>
              </div>
            ) : projects.length > 0 ? (
              <MapComponent projects={projects} />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center space-y-2 text-muted-foreground p-6 text-center">
                <ShieldAlert size={36} className="text-muted-foreground/50" />
                <p className="font-semibold text-sm">Tidak ada site dengan koordinat koordinat valid</p>
                <p className="text-xs">Cobalah ganti filter pencarian atau pastikan data Excel Anda memiliki kolom Lat & Long yang terisi.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </AppLayout>
  );
}
