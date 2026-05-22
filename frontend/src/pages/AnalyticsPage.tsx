import { CircleDollarSign, LineChart as LineChartIcon, PieChart, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Account, AssetsDailyRow, getAssetsTimeline, getLatestAssets } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatCurrency, formatNumber, profitClass, signedCurrency } from "../lib/format";
import { cn } from "../lib/utils";

type AnalyticsPageProps = {
  refreshKey: number;
  account: Account;
};

type RangeMode = "7" | "30" | "90" | "180" | "365" | "custom";

const rangeOptions: Array<{ label: string; value: RangeMode; days?: number }> = [
  { label: "近7日", value: "7", days: 7 },
  { label: "近30日", value: "30", days: 30 },
  { label: "近90日", value: "90", days: 90 },
  { label: "近半年", value: "180", days: 180 },
  { label: "近1年", value: "365", days: 365 },
  { label: "自定义", value: "custom" },
];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg">
      <div className="mb-2 text-sm font-semibold text-slate-700">日期 {label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-3 text-sm">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-slate-900">{formatCurrency(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage({ refreshKey, account }: AnalyticsPageProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("90");
  const [customDays, setCustomDays] = useState(60);
  const [assetCurve, setAssetCurve] = useState<AssetsDailyRow[]>([]);
  const [latestAssets, setLatestAssets] = useState<AssetsDailyRow | null>(null);
  const rangeDays = rangeMode === "custom" ? customDays : Number(rangeMode);

  useEffect(() => {
    void getAssetsTimeline(account.id, rangeDays).then(setAssetCurve).catch(() => setAssetCurve([]));
  }, [account.id, rangeDays, refreshKey]);

  useEffect(() => {
    void getLatestAssets(account.id).then(setLatestAssets).catch(() => setLatestAssets(null));
  }, [account.id, refreshKey]);

  const chartData = useMemo(
    () =>
      assetCurve.map((row) => ({
        date: row.snapshot_date.slice(5),
        fullDate: row.snapshot_date,
        total_assets: row.total_assets ?? null,
        market_value: row.market_value ?? null,
        cash_available: row.cash_available ?? null,
        daily_profit_loss: row.daily_profit_loss ?? null,
      })),
    [assetCurve],
  );

  const changeStart = chartData[0]?.total_assets ?? null;
  const changeEnd = chartData[chartData.length - 1]?.total_assets ?? null;
  const totalChange = changeStart !== null && changeEnd !== null ? changeEnd - changeStart : null;

  return (
    <div className="space-y-6">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-600">总资产</div>
              <div className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">
                {formatCurrency(latestAssets?.total_assets)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
              <PieChart className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-600">持仓市值</div>
              <div className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">
                {formatCurrency(latestAssets?.market_value)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CircleDollarSign className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-600">可用现金</div>
              <div className="mt-2 truncate text-2xl font-bold tabular-nums text-slate-950">
                {formatCurrency(latestAssets?.cash_available)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-5 p-6">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
              <TrendingUp className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-600">期间变动</div>
              <div className={cn("mt-2 truncate text-2xl font-bold tabular-nums", profitClass(totalChange))}>
                {signedCurrency(totalChange)}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>资产曲线</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg bg-[var(--border-light)] p-1">
              {rangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRangeMode(option.value)}
                  className={cn(
                    "h-8 rounded-md px-3 text-xs font-semibold transition",
                    rangeMode === option.value
                      ? "bg-primary-light text-primary shadow-sm"
                      : "text-text-secondary hover:bg-[var(--bg-hover)] hover:text-text-primary",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {rangeMode === "custom" ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={customDays}
                  onChange={(e) => setCustomDays(Math.max(1, Math.min(3650, Number(e.target.value) || 1)))}
                  className="h-8 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 text-xs font-semibold text-text-primary outline-none focus:border-primary"
                />
                <span className="text-xs text-text-tertiary">天</span>
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="h-[520px]">
          {chartData.length >= 3 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: 16, bottom: 8 }}>
                <defs>
                  <linearGradient id="totalAssetsFillA" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="marketValueFillA" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--text-tertiary)" }}
                  axisLine={false}
                  tickLine={false}
                  width={72}
                  tickFormatter={(v: number) => (v >= 10000 ? `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}万` : v.toLocaleString())}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={40}
                  formatter={(value: string) => <span className="text-sm font-semibold text-text-secondary">{value}</span>}
                />
                <Area
                  connectNulls={false}
                  type="monotone"
                  dataKey="total_assets"
                  name="总资产"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#totalAssetsFillA)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#2563EB" }}
                />
                <Area
                  connectNulls={false}
                  type="monotone"
                  dataKey="market_value"
                  name="持仓市值"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  fill="url(#marketValueFillA)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#8B5CF6" }}
                />
                <Line
                  connectNulls={false}
                  type="monotone"
                  dataKey="cash_available"
                  name="可用现金"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: "#10B981" }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-stripe)]">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
                <TrendingUp className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-text-secondary">数据积累中</p>
              <p className="mt-1 text-xs text-text-tertiary">继续上传几天的资产截图，就能看到完整的资产曲线</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
