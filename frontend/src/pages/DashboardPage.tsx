import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CloudUpload,
  FileClock,
  LineChart as LineChartIcon,
  PieChart,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Account, ConsistencyResult, DashboardSummaryData, getConsistencyCheck, getDashboardSummary } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { formatCurrency, formatNumber, marketTag, profitBadge, profitClass, signedCurrency } from "../lib/format";
import { cn } from "../lib/utils";

type DashboardPageProps = {
  refreshKey: number;
  account: Account;
  onNavigate?: (page: "holdings" | "transactions" | "upload") => void;
};

type RangeMode = "7" | "30" | "90" | "custom";

const rangeOptions: Array<{ label: string; value: RangeMode; days?: number }> = [
  { label: "近7日", value: "7", days: 7 },
  { label: "近30日", value: "30", days: 30 },
  { label: "近90日", value: "90", days: 90 },
  { label: "自定义", value: "custom" },
];

function sparklineData(curve: Array<{ date: string; total_assets: number | null; market_value: number | null; cash_available: number | null }>, key: "total_assets" | "market_value" | "cash_available") {
  return curve
    .filter((p) => p[key] !== null)
    .map((p) => ({ v: p[key] }));
}

function MiniSparkline({ data, tone }: { data: Array<{ v: number | null }>; tone: "blue" | "purple" | "green" | "red" }) {
  const strokeColor = { blue: "#2563EB", purple: "#8B5CF6", green: "#10B981", red: "#EF4444" }[tone];
  const points = data.filter((d) => d.v !== null);
  if (points.length < 2) {
    return (
      <div className="flex h-[30px] items-center justify-center">
        <svg width="100%" height="30">
          <line x1="8" y1="15" x2="calc(100% - 8)" y2="15" stroke="#E5E7EB" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      </div>
    );
  }
  const vals = points.map((d) => d.v!);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 100 / (points.length - 1 || 1);
  const pathD = points
    .map((d, i) => {
      const x = i * w;
      const y = 28 - ((d.v! - min) / range) * 24;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
  return (
    <div className="h-[30px]">
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-full w-full">
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function changeBadge(delta: number | null | undefined) {
  if (delta === null || delta === undefined) return null;
  const isUp = delta > 0;
  const isDown = delta < 0;
  const cls = isUp ? "text-up bg-up-bg" : isDown ? "text-down bg-down-bg" : "text-text-tertiary bg-[var(--border-light)]";
  const sign = isUp ? "+" : "";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ${cls}`}>
      {sign}{formatCurrency(delta)}
    </span>
  );
}

function StatCard({
  title,
  value,
  delta,
  deltaPct,
  icon,
  tone,
  sparkline,
}: {
  title: string;
  value: string;
  delta: number | null | undefined;
  deltaPct?: number | null | undefined;
  icon: React.ReactNode;
  tone: "blue" | "purple" | "green" | "red";
  sparkline?: Array<{ v: number | null }>;
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
  }[tone];

  return (
    <Card className="shadow-card">
      <CardContent className="p-5">
        {/* 标题行 */}
        <div className="flex items-center gap-2.5">
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", toneClass)}>{icon}</div>
          <span className="text-sm font-semibold text-text-secondary">{title}</span>
        </div>

        {/* 大数字 */}
        <div className="mt-3 text-[32px] font-semibold leading-tight tabular-nums text-text-primary">{value}</div>

        {/* 迷你趋势线 */}
        <div className="mt-2">{sparkline ? <MiniSparkline data={sparkline} tone={tone} /> : null}</div>

        {/* 变化值 */}
        <div className="mt-2 flex items-center gap-2 text-xs">
          {delta !== null && delta !== undefined ? (
            <>
              {changeBadge(delta)}
              {deltaPct !== null && deltaPct !== undefined ? changeBadge(deltaPct) : null}
            </>
          ) : (
            <span className="text-text-tertiary">暂无对比数据</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TradeBadge({ direction }: { direction: "buy" | "sell" }) {
  const isBuy = direction === "buy";
  return (
    <span className={cn("inline-flex rounded-md px-2 py-1 text-xs font-semibold", isBuy ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600")}>
      {isBuy ? "买入" : "卖出"}
    </span>
  );
}

function StatusTile({
  icon,
  value,
  label,
  caption,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  caption: string;
  tone: "orange" | "green" | "blue" | "purple";
}) {
  const classes = {
    orange: "bg-orange-50 text-orange-500",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <div className={cn("rounded-xl border border-slate-100 p-5", classes)}>
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">{icon}</div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{label}</div>
      <div className="mt-1 text-xs text-slate-500">{caption}</div>
    </div>
  );
}

export default function DashboardPage({ refreshKey, account, onNavigate }: DashboardPageProps) {
  const [rangeMode, setRangeMode] = useState<RangeMode>("30");
  const [customDays, setCustomDays] = useState(120);
  const [data, setData] = useState<DashboardSummaryData | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyResult | null>(null);
  const [showConsistencyDetails, setShowConsistencyDetails] = useState(false);
  const rangeDays = rangeMode === "custom" ? customDays : Number(rangeMode);

  useEffect(() => {
    void getDashboardSummary(account.id, rangeDays).then(setData).catch(() => setData(null));
  }, [account.id, rangeDays, refreshKey]);

  useEffect(() => {
    void getConsistencyCheck(account.id).then(setConsistency).catch(() => setConsistency(null));
  }, [account.id, refreshKey]);

  const summary = data?.summary;
  const changes = summary?.change_vs_previous;
  const holdings = data?.holdings ?? [];
  const recognition = data?.recognition ?? { pending: 0, confirmed: 0, rejected: 0, today_uploads: 0, upload_streak_days: 0 };
  const trades = data?.recent_transactions ?? [];
  const chartData = useMemo(
    () =>
      (data?.asset_curve ?? []).map((row) => ({
        date: row.snapshot_date.slice(5),
        total_assets: row.total_assets ?? null,
        market_value: row.market_value ?? null,
        cash_available: row.cash_available ?? null,
      })),
    [data?.asset_curve],
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="总资产"
          value={summary?.has_assets_data ? formatCurrency(summary.total_assets) : "--"}
          delta={summary?.has_assets_data ? changes?.total_assets : null}
          icon={<Wallet className="h-5 w-5" />}
          tone="blue"
          sparkline={sparklineData(chartData, "total_assets")}
        />
        <StatCard
          title="持仓市值"
          value={summary?.has_assets_data ? formatCurrency(summary.market_value) : formatCurrency(summary?.market_value ?? 0)}
          delta={summary?.has_assets_data ? changes?.market_value : null}
          icon={<PieChart className="h-5 w-5" />}
          tone="purple"
          sparkline={sparklineData(chartData, "market_value")}
        />
        <StatCard
          title="可用现金"
          value={summary?.has_assets_data ? formatCurrency(summary.cash_available) : "--"}
          delta={summary?.has_assets_data ? changes?.cash_available : null}
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="green"
          sparkline={sparklineData(chartData, "cash_available")}
        />
        <StatCard
          title="当日盈亏"
          value={summary?.has_assets_data ? signedCurrency(summary.daily_profit_loss) : "--"}
          delta={summary?.has_assets_data ? changes?.daily_profit_loss : null}
          icon={<LineChartIcon className="h-5 w-5" />}
          tone="red"
        />
      </section>

      {!summary?.has_assets_data ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          尚未上传资产页截图，总资产/可用现金/当日盈亏需上传资产页后才能显示。
          {" "}持仓市值来自持仓页截图。
        </div>
      ) : null}

      {consistency && consistency.issue_count > 0 ? (
        <section>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-base font-bold text-amber-900">
                    检测到 {consistency.issue_count} 条数据可能不一致
                  </div>
                  <div className="mt-1 text-sm text-amber-700">
                    成交记录与持仓快照之间存在差异，点击查看详情。系统不会自动修改您的数据。
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConsistencyDetails(!showConsistencyDetails)}
                  className="shrink-0 rounded-lg bg-amber-200 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-300"
                >
                  {showConsistencyDetails ? "收起" : "点击查看"}
                </button>
              </div>
            </div>

            {showConsistencyDetails ? (
              <div className="mt-4 space-y-3">
                {consistency.issues.map((issue, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-slate-800">{issue.stock_code}</span>
                          {issue.stock_name ? <span className="text-sm text-slate-500">{issue.stock_name}</span> : null}
                          <span className={cn(
                            "rounded-md px-2 py-0.5 text-xs font-semibold",
                            issue.type === "quantity_mismatch" ? "bg-red-50 text-red-500" :
                            issue.type === "missing_holding" ? "bg-orange-50 text-orange-500" :
                            "bg-blue-50 text-blue-600",
                          )}>
                            {issue.type === "quantity_mismatch" ? "数量不一致" :
                             issue.type === "missing_holding" ? "缺少持仓" : "缺少成交记录"}
                          </span>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-600">{issue.message}</div>
                      </div>
                      {issue.type === "quantity_mismatch" ? (
                        <div className="shrink-0 text-right text-sm">
                          <div className="text-slate-500">预期: {issue.expected_quantity.toLocaleString()} 股</div>
                          <div className="text-slate-500">实际: {issue.actual_quantity.toLocaleString()} 股</div>
                          <div className={cn("font-semibold", issue.difference > 0 ? "text-red-500" : "text-emerald-600")}>
                            差额 {issue.difference > 0 ? "+" : ""}{issue.difference.toLocaleString()} 股
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.05fr]">
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
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={customDays}
                  onChange={(event) => setCustomDays(Math.max(1, Math.min(3650, Number(event.target.value) || 1)))}
                  className="h-8 w-20 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 text-xs font-semibold text-text-primary outline-none focus:border-primary"
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="h-80">
            {chartData.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ left: 0, right: 16, top: 10, bottom: 8 }}>
                  <defs>
                    <linearGradient id="assetFillDash" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#2563EB" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#2563EB" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border-light)" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--text-tertiary)" }}
                    axisLine={false}
                    tickLine={false}
                    width={72}
                    tickFormatter={(v: number) => (v >= 10000 ? `${(v / 10000).toFixed(v % 10000 === 0 ? 0 : 1)}万` : v.toLocaleString())}
                  />
                  <Tooltip
                    contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}
                    formatter={(value) => formatCurrency(Number(value))}
                    labelFormatter={(label) => `日期 ${label}`}
                  />
                  <Area connectNulls={false} type="monotone" dataKey="total_assets" name="总资产" stroke="#2563EB" strokeWidth={2.5} fill="url(#assetFillDash)" />
                  <Line connectNulls={false} type="monotone" dataKey="market_value" name="持仓市值" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                  <Line connectNulls={false} type="monotone" dataKey="cash_available" name="可用现金" stroke="#10B981" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-stripe)]">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
                  <LineChartIcon className="h-7 w-7" />
                </div>
                <p className="mt-4 text-sm font-semibold text-text-secondary">数据积累中</p>
                <p className="mt-1 text-xs text-text-tertiary">继续上传几天的资产截图，就能看到完整的资产曲线</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>持仓概览</CardTitle>
            <Button variant="ghost" className="h-8 px-2 text-blue-600" onClick={() => onNavigate?.("holdings")}>
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <Th>代码</Th>
                    <Th>名称</Th>
                    <Th className="text-right">数量</Th>
                    <Th className="text-right">成本价</Th>
                    <Th className="text-right">现价</Th>
                    <Th className="text-right">市值</Th>
                    <Th className="text-right">盈亏</Th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.slice(0, 5).map((row, i) => {
                    const tag = marketTag(row.stock_code);
                    return (
                      <tr
                        key={`${row.snapshot_date}-${row.stock_code}-${row.id}`}
                        className={cn(
                          "transition-colors hover:bg-[var(--bg-hover)]",
                          i % 2 === 1 ? "bg-[var(--bg-stripe)]" : "bg-[var(--bg-card)]",
                        )}
                      >
                        <Td className="font-mono text-sm font-semibold tracking-wide text-text-primary">{row.stock_code}</Td>
                        <Td>
                          <span>{row.stock_name ?? "--"}</span>
                          {tag ? (
                            <span className="ml-1.5 inline-flex rounded bg-[var(--border-light)] px-1.5 py-0.5 text-[11px] font-semibold text-text-tertiary">
                              {tag}
                            </span>
                          ) : null}
                        </Td>
                        <Td className="text-right tabular-nums">{formatNumber(row.quantity)}</Td>
                        <Td className="text-right tabular-nums">{formatCurrency(row.cost_price)}</Td>
                        <Td className="text-right tabular-nums">{formatCurrency(row.current_price)}</Td>
                        <Td className="text-right tabular-nums font-semibold">{formatCurrency(row.market_value)}</Td>
                        <Td className="text-right">{profitBadge(row.profit_loss)}</Td>
                      </tr>
                    );
                  })}
                  {!holdings.length ? (
                    <tr>
                      <Td colSpan={7} className="py-16 text-center text-text-tertiary">
                        暂无持仓数据
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.05fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>最近交易</CardTitle>
            <Button variant="ghost" className="h-8 px-2 text-blue-600" onClick={() => onNavigate?.("transactions")}>
              查看全部
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>时间</Th>
                    <Th>股票代码</Th>
                    <Th>股票名称</Th>
                    <Th>操作</Th>
                    <Th className="text-right">数量</Th>
                    <Th className="text-right">价格</Th>
                    <Th className="text-right">金额</Th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((row) => (
                    <tr key={row.id}>
                      <Td className="tabular-nums">{row.trade_time.slice(5, 16)}</Td>
                      <Td className="font-semibold tabular-nums text-slate-700">{row.stock_code}</Td>
                      <Td>{row.stock_name}</Td>
                      <Td>
                        <TradeBadge direction={row.direction} />
                      </Td>
                      <Td className="text-right tabular-nums">{formatNumber(row.quantity)}</Td>
                      <Td className="text-right tabular-nums">{formatNumber(row.price)}</Td>
                      <Td className="text-right tabular-nums">{formatCurrency(row.amount)}</Td>
                    </tr>
                  ))}
                  {!trades.length ? (
                    <tr>
                      <Td colSpan={7} className="py-12 text-center text-slate-500">
                        暂无交易记录
                      </Td>
                    </tr>
                  ) : null}
                </tbody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>识别状态</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatusTile icon={<FileClock className="h-5 w-5" />} value={recognition.pending} label="待确认截图" caption="待处理" tone="orange" />
              <StatusTile icon={<CheckCircle2 className="h-5 w-5" />} value={recognition.confirmed} label="已确认记录" caption="累计" tone="green" />
              <StatusTile icon={<CloudUpload className="h-5 w-5" />} value={recognition.today_uploads} label="今日上传数量" caption="今日" tone="blue" />
              <StatusTile icon={<CalendarDays className="h-5 w-5" />} value={recognition.upload_streak_days} label="连续上传天数" caption="本周" tone="purple" />
            </div>
            <div className="mt-5 text-xs text-slate-400">
              所有识别和数据均保存在本地，不会上送到任何服务器。
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
