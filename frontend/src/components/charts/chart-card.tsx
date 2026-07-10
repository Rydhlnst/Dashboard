"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DynamicChart } from "./dynamic-chart";
import { chartsApi, chartPrefsApi } from "@/lib/api";
import { ChartData, ChartType, CHART_TYPES, GROUP_BY_OPTIONS } from "@/types/chart";
import { toast } from "sonner";
import { Save, RefreshCw } from "lucide-react";

interface ChartCardProps {
  chartKey: string;
  title: string;
  defaultGroupBy: string;
  initialChartType?: ChartType;
  initialGroupBy?: string;
}

export function ChartCard({
  chartKey,
  title,
  defaultGroupBy,
  initialChartType = "bar",
  initialGroupBy,
}: ChartCardProps) {
  const [chartType, setChartType] = useState<ChartType>(initialChartType);
  const [groupBy, setGroupBy] = useState(initialGroupBy || defaultGroupBy);
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await chartsApi.data({ group_by: groupBy });
      if (res.success) setData(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [groupBy]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res: any = await chartPrefsApi.save({ chart_key: chartKey, chart_type: chartType, group_by: groupBy });
      if (res.success) {
        toast.success("Preferensi chart disimpan.");
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Gagal menyimpan preferensi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={groupBy} onValueChange={setGroupBy}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value} className="text-xs">
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button size="sm" variant="outline" className="h-8 px-2" onClick={fetchData} disabled={loading}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </Button>

            <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleSave} disabled={saving}>
              <Save size={14} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : data ? (
          <DynamicChart data={data} chartType={chartType} />
        ) : (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            Gagal memuat data
          </div>
        )}
      </CardContent>
    </Card>
  );
}
