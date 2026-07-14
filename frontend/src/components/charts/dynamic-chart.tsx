"use client";

import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ScatterChart, Scatter, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartData, ChartType } from "@/types/chart";

const COLORS = [
  "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6",
  "#ec4899","#14b8a6","#f97316","#6366f1","#84cc16",
];

interface DynamicChartProps {
  data: ChartData;
  chartType: ChartType;
  height?: number;
}

export function DynamicChart({ data, chartType, height = 300 }: DynamicChartProps) {
  const items = data.items.slice(0, 20);

  if (!items.length) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
        Tidak ada data untuk ditampilkan
      </div>
    );
  }

  const chartData = items.map((d) => ({ name: d.label, value: d.value }));

  switch (chartType) {
    case "line":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={COLORS[0]} strokeWidth={2} dot />
          </LineChart>
        </ResponsiveContainer>
      );

    case "area":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke={COLORS[0]} fill={COLORS[0] + "33"} />
          </AreaChart>
        </ResponsiveContainer>
      );

    case "pie":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );

    case "donut":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );

    case "radar":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <RadarChart data={chartData.slice(0, 10)}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
            <Radar dataKey="value" stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.4} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      );

    case "scatter":
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ScatterChart>
            <CartesianGrid />
            <XAxis dataKey="name" name="Label" tick={{ fontSize: 11 }} />
            <YAxis dataKey="value" name="Value" tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={chartData} fill={COLORS[0]} />
          </ScatterChart>
        </ResponsiveContainer>
      );

    case "scurve": {
      let cum = 0;
      const scurveData = chartData.map((d) => {
        cum += Number(d.value) || 0;
        return { name: d.name, value: d.value, cumulative: cum };
      });
      return (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={scurveData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="value" name="Per Period" fill={COLORS[0] + "99"} radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke={COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    }

    case "radial":
      // Radial: displayed as horizontal bar for simplicity
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );

    default: // bar
      return (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
  }
}
