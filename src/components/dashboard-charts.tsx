"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconExclamationCircle,
  IconEye,
} from "@tabler/icons-react";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

/**
 * Chart primitives for the dashboards.
 *
 * Palette: the validated reference palette (dataviz skill) — slot 1 blue for
 * any single-series chart, slot 1 + slot 2 (blue, orange) for the one
 * two-series chart, each stepped separately for light and dark surfaces. Both
 * pairs pass the CVD and normal-vision floors in both modes. Status colours
 * (good / warning / serious / critical) are reserved for the retention band
 * bar and always ship with an icon and a label, never colour alone.
 *
 * Marks: columns capped at 24px with a 4px rounded top; 2px lines with 8px
 * end markers; area fills at 10%; hairline horizontal grid only; text in text
 * tokens, never in the series colour.
 */

export const SERIES = {
  one: { light: "#2a78d6", dark: "#3987e5" },
  two: { light: "#eb6834", dark: "#d95926" },
} as const;

export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

const axisTick = { fontSize: 11 };

/* ───────────────────────────── single-series columns ─────────────────────── */

export type ColumnDatum = { label: string; value: number; [k: string]: unknown };

export function ColumnChart({
  data,
  seriesLabel,
  unit,
  height = 220,
  className,
}: {
  data: ColumnDatum[];
  seriesLabel: string;
  unit?: string;
  height?: number;
  className?: string;
}) {
  const config: ChartConfig = { value: { label: seriesLabel, theme: SERIES.one } };
  const dense = data.length > 12;
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} strokeWidth={1} className="stroke-border" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={dense ? "preserveStartEnd" : 0}
          minTickGap={dense ? 24 : 4}
          tick={axisTick}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tick={axisTick} />
        <ChartTooltip
          cursor={{ fill: "currentColor", opacity: 0.06 }}
          content={<ChartTooltipContent formatter={(v) => `${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`} />}
        />
        <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}

/* ───────────────────────────── two-series columns ────────────────────────── */

export type TwoSeriesDatum = { label: string; a: number; b: number };

export function GroupedColumns({
  data,
  labels,
  currency = false,
  height = 240,
  className,
}: {
  data: TwoSeriesDatum[];
  labels: { a: string; b: string };
  /** Format values as whole pesos. A flag rather than a formatter: functions cannot cross the server/client boundary. */
  currency?: boolean;
  height?: number;
  className?: string;
}) {
  const format = (v: number) => (currency ? `₱${Math.round(v).toLocaleString("en-PH")}` : v.toLocaleString());
  const config: ChartConfig = {
    a: { label: labels.a, theme: SERIES.one },
    b: { label: labels.b, theme: SERIES.two },
  };
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="30%" barGap={2}>
        <CartesianGrid vertical={false} strokeWidth={1} className="stroke-border" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tick={axisTick}
          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <ChartTooltip content={<ChartTooltipContent formatter={(v) => format(Number(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="a" fill="var(--color-a)" radius={[4, 4, 0, 0]} maxBarSize={24} />
        <Bar dataKey="b" fill="var(--color-b)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  );
}

/* ───────────────────────────── single-series trend ───────────────────────── */

export type TrendDatum = { label: string; value: number | null };

export function TrendChart({
  data,
  seriesLabel,
  unit,
  area = false,
  height = 220,
  className,
}: {
  data: TrendDatum[];
  seriesLabel: string;
  unit?: string;
  /** Area wash under the line — for a single series over time. */
  area?: boolean;
  height?: number;
  className?: string;
}) {
  const config: ChartConfig = { value: { label: seriesLabel, theme: SERIES.one } };
  const fmt = (v: unknown) => `${Number(v).toLocaleString()}${unit ? ` ${unit}` : ""}`;
  const common = {
    data,
    margin: { top: 12, right: 12, left: -8, bottom: 0 },
  };
  const dot = { r: 4, strokeWidth: 2, stroke: "var(--background)", fill: "var(--color-value)" };
  return (
    <ChartContainer config={config} className={cn("w-full", className)} style={{ height }}>
      {area ? (
        <AreaChart {...common}>
          <CartesianGrid vertical={false} strokeWidth={1} className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} domain={["auto", "auto"]} />
          <ChartTooltip content={<ChartTooltipContent formatter={fmt} />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            fill="var(--color-value)"
            fillOpacity={0.1}
            dot={dot}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </AreaChart>
      ) : (
        <LineChart {...common}>
          <CartesianGrid vertical={false} strokeWidth={1} className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} tick={axisTick} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={48} tick={axisTick} domain={["auto", "auto"]} />
          <ChartTooltip content={<ChartTooltipContent formatter={fmt} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={dot}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      )}
    </ChartContainer>
  );
}

/* ───────────────────────────── status band bar ───────────────────────────── */

export type StatusSegment = {
  key: string;
  label: string;
  value: number;
  status: keyof typeof STATUS;
  hint?: string;
};

const STATUS_ICON: Record<keyof typeof STATUS, React.ComponentType<{ className?: string }>> = {
  good: IconCircleCheck,
  warning: IconEye,
  serious: IconExclamationCircle,
  critical: IconAlertTriangle,
};

/**
 * Part-to-whole across ordered status bands. A single horizontal stacked bar
 * with 2px surface gaps between segments, plus a legend row that carries the
 * icon, the label and the count — so the colour never has to work alone.
 */
export function StatusBandBar({ segments, className }: { segments: StatusSegment[]; className?: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}>
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((s, i) => (
              <div
                key={s.key}
                className={cn("h-full", i > 0 && "border-l-2 border-background")}
                style={{ width: `${(s.value / total) * 100}%`, backgroundColor: STATUS[s.status] }}
              />
            ))}
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {segments.map((s) => {
          const Icon = STATUS_ICON[s.status];
          return (
            <li key={s.key} className="flex items-start gap-2">
              <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm" style={{ backgroundColor: STATUS[s.status] }}>
                <Icon className="size-3 text-white" />
              </span>
              <span className="flex flex-col leading-tight">
                <span>
                  <span className="font-semibold">{s.value}</span> <span className="text-muted-foreground">{s.label}</span>
                </span>
                {s.hint && <span className="text-muted-foreground text-xs">{s.hint}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ───────────────────────────── table twin ────────────────────────────────── */

/** Every chart's WCAG-clean equivalent: the same rows as plain text, collapsed by default. */
export function DataTableTwin({ caption, rows, columns }: { caption: string; rows: Array<Record<string, unknown>>; columns: Array<{ key: string; label: string }> }) {
  return (
    <details className="text-muted-foreground mt-2 text-xs">
      <summary className="cursor-pointer select-none">Show as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left tabular-nums">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="pr-3 pb-1 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60">
                {columns.map((c) => (
                  <td key={c.key} className="pr-3 py-1 text-foreground">{String(r[c.key] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
