import { CircleDollarSign, TrendingUp, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  PieChart,
  Pie,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Account, AnalyticsOverview, AssetsDailyRow, getAnalyticsOverview, getAssetsTimeline, getLatestAssets } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { formatCurrency, profitClass, signedCurrency } from "../lib/format";
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

const PIE_COLORS = ["#2563EB", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#6B7280"];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 shadow-card">
      <div className="mb-2 text-sm font-semibold text-text-secondary">日期 {label}</div>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-3 text-sm">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-text-secondary">{entry.name}</span>
          <span className="ml-auto font-semibold tabular-nums text-text-primary">{formatCurrency(Number(entry.value))}</span>
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
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const rangeDays = rangeMode === "custom" ? customDays : Number(rangeMode);

  useEffect(() => {
    void getAssetsTimeline(account.id, rangeDays).then(setAssetCurve).catch(() => setAssetCurve([]));
  }, [account.id, rangeDays, refreshKey]);

  useEffect(() => {
    void getLatestAssets(account.id).then(setLatestAssets).catch(() => setLatestAssets(null));
  }, [account.id, refreshKey]);

  useEffect(() => {
    void getAnalyticsOverview(account.id).then(setOverview).catch(() => setOverview(null));
  }, [account.id, refreshKey]);

  const chartData = useMemo(
    () =>
      assetCurve.map((row) => ({
        date: row.snapshot_date.slice(5),
        total_assets: row.total_assets ?? null,
        market_value: row.market_value ?? null,
        cash_available: row.cash_available ?? null,
      })),
    [assetCurve],
  );

  const changeStart = chartData[0]?.total_assets ?? null;
  const changeEnd = chartData[chartData.length - 1]?.total_assets ?? null;
  const totalChange = changeStart !== null && changeEnd !== null ? changeEnd - changeStart : null;

  const profitRankData = useMemo(
    () =>
      (overview?.profit_ranking ?? []).map((item) => ({
        name: item.stock_code,
        fullName: item.stock_name,
        value: item.profit_loss,
        pct: item.profit_loss_pct,
      })),
    [overview],
  );

  const monthStats = overview?.monthly_stats;

  return (
    <div className="space-y-5">
      {/* 顶部汇总 */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">总资产</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(latestAssets?.total_assets)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">持仓市值</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(latestAssets?.market_value)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">可用现金</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(latestAssets?.cash_available)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">期间变动</div>
            <div className={cn("mt-2 text-xl font-bold tabular-nums", profitClass(totalChange))}>{signedCurrency(totalChange)}</div>
          </CardContent>
        </Card>
      </section>

      {/* 资产曲线大图 */}
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
        <CardContent className="h-[420px]">
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
                <Area connectNulls={false} type="monotone" dataKey="total_assets" name="总资产" stroke="#2563EB" strokeWidth={2.5} fill="url(#totalAssetsFillA)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#2563EB" }} />
                <Area connectNulls={false} type="monotone" dataKey="market_value" name="持仓市值" stroke="#8B5CF6" strokeWidth={2} fill="url(#marketValueFillA)" dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#8B5CF6" }} />
                <Line connectNulls={false} type="monotone" dataKey="cash_available" name="可用现金" stroke="#10B981" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: "#10B981" }} />
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

      {/* 下面三列：盈亏排行 + 本月交易 + 持仓集中度 */}
      <section className="grid gap-5 xl:grid-cols-3">
        {/* 持仓盈亏排行 Top 5 */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>持仓盈亏排行 Top 5</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {profitRankData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitRankData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                  <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 4" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "var(--text-primary)", fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <Tooltip
                    formatter={(value: number) => [signedCurrency(value), "盈亏"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {profitRankData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 0 ? "var(--up)" : "var(--down)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-tertiary">暂无持仓数据</div>
            )}
          </CardContent>
        </Card>

        {/* 本月交易统计 */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>本月交易统计</CardTitle>
          </CardHeader>
          <CardContent>
            {monthStats && monthStats.trade_count > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-[var(--bg-stripe)] p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums text-text-primary">{monthStats.trade_count}</div>
                    <div className="mt-1 text-xs text-text-tertiary">总笔数</div>
                  </div>
                  <div className="rounded-lg bg-[var(--bg-stripe)] p-3 text-center">
                    <div className="text-2xl font-bold tabular-nums text-text-primary">{monthStats.buy_count + monthStats.sell_count}</div>
                    <div className="mt-1 text-xs text-text-tertiary">买卖合计</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-up">买入</span>
                      <span className="tabular-nums text-text-secondary">{monthStats.buy_count} 笔</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--border-light)]">
                      <div
                        className="h-full rounded-full bg-up transition"
                        style={{ width: `${monthStats.trade_count ? (monthStats.buy_count / monthStats.trade_count) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs tabular-nums text-text-secondary">{formatCurrency(monthStats.buy_amount)}</div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-semibold text-down">卖出</span>
                      <span className="tabular-nums text-text-secondary">{monthStats.sell_count} 笔</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--border-light)]">
                      <div
                        className="h-full rounded-full bg-down transition"
                        style={{ width: `${monthStats.trade_count ? (monthStats.sell_count / monthStats.trade_count) * 100 : 0}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs tabular-nums text-text-secondary">{formatCurrency(monthStats.sell_amount)}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-[250px] items-center justify-center text-sm text-text-tertiary">本月暂无交易</div>
            )}
          </CardContent>
        </Card>

        {/* 持仓集中度 */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>持仓集中度</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {overview?.concentration && overview.concentration.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={overview.concentration}
                    dataKey="market_value"
                    nameKey="stock_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {overview.concentration.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), "市值"]}
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }}
                  />
                  <Legend
                    formatter={(value: string) => <span className="text-xs text-text-secondary">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-tertiary">暂无持仓数据</div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
