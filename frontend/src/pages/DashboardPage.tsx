import { CalendarDays, CheckCircle2, CloudUpload, FileClock, LineChart as LineChartIcon, PieChart, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Account, DashboardData, getDashboardData } from "../api/client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { formatCurrency, formatNumber, profitClass, signedCurrency } from "../lib/format";

type DashboardPageProps = {
  refreshKey: number;
  account: Account;
};

function StatCard({
  title,
  value,
  delta,
  icon,
  tone,
}: {
  title: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  tone: "blue" | "purple" | "green" | "red";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-500",
  }[tone];

  return (
    <Card className="min-h-32">
      <CardContent className="flex items-center gap-5 p-6">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toneClass}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-600">{title}</div>
          <div className="mt-2 truncate text-2xl font-bold text-slate-950">{value}</div>
          <div className="mt-2 text-xs text-slate-400">
            Change <span className={profitClass(Number(delta.replace(/[¥,+%]/g, "")))}>{delta}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage({ refreshKey, account }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    void getDashboardData(account.id).then(setData).catch(() => setData(null));
  }, [account.id, refreshKey]);

  const summary = data?.summary;
  const holdings = data?.holdings ?? [];
  const recognition = data?.recognition ?? { pending: 0, confirmed: 0, rejected: 0, today_uploads: 0, upload_streak_days: 0 };
  const totalProfitPct = useMemo(() => {
    const totalCost = holdings.reduce((sum, row) => sum + Math.max((row.cost_price ?? 0) * (row.quantity ?? 0), 0), 0);
    if (!totalCost) return 0;
    return ((summary?.daily_profit_loss ?? 0) / totalCost) * 100;
  }, [holdings, summary?.daily_profit_loss]);
  const curve = data?.asset_curve.length
    ? data.asset_curve
    : [{ date: new Date().toISOString().slice(5, 10), total_assets: summary?.total_assets ?? 0 }];

  return (
    <div className="space-y-6">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Assets" value={formatCurrency(summary?.total_assets ?? 0)} delta={signedCurrency(summary?.daily_profit_loss ?? 0)} icon={<Wallet className="h-7 w-7" />} tone="blue" />
        <StatCard title="Market Value" value={formatCurrency(summary?.market_value ?? 0)} delta={signedCurrency(summary?.daily_profit_loss ?? 0)} icon={<PieChart className="h-7 w-7" />} tone="purple" />
        <StatCard title="Cash" value={formatCurrency(summary?.cash_available ?? 0)} delta="+¥0.00" icon={<Wallet className="h-7 w-7" />} tone="green" />
        <StatCard title="P/L" value={signedCurrency(summary?.daily_profit_loss ?? 0)} delta={`${totalProfitPct >= 0 ? "+" : ""}${formatNumber(totalProfitPct, "%")}`} icon={<LineChartIcon className="h-7 w-7" />} tone="red" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Asset Curve - {account.name}</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ left: 0, right: 12, top: 10, bottom: 8 }}>
                <defs>
                  <linearGradient id="assetFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Area type="monotone" dataKey="total_assets" stroke="#2563eb" strokeWidth={3} fill="url(#assetFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Holdings Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-100">
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Cost</Th>
                    <Th className="text-right">Price</Th>
                    <Th className="text-right">Value</Th>
                    <Th className="text-right">P/L</Th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.slice(0, 5).map((row) => (
                    <tr key={`${row.snapshot_date}-${row.stock_code}-${row.id}`}>
                      <Td className="font-semibold text-slate-700">{row.stock_code}</Td>
                      <Td>{row.stock_name}</Td>
                      <Td className="text-right">{formatNumber(row.quantity)}</Td>
                      <Td className="text-right">{formatNumber(row.cost_price)}</Td>
                      <Td className="text-right">{formatNumber(row.current_price)}</Td>
                      <Td className="text-right">{formatCurrency(row.market_value)}</Td>
                      <Td className={`text-right font-semibold ${profitClass(row.profit_loss)}`}>{signedCurrency(row.profit_loss)}</Td>
                    </tr>
                  ))}
                  {!holdings.length ? (
                    <tr>
                      <Td colSpan={7} className="py-12 text-center text-slate-500">
                        No holdings for this account yet.
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
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-5 py-12 text-center text-sm text-slate-500">
              Trade collection will be added in phase 2.
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recognition Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              <StatusTile icon={<FileClock />} value={recognition.pending} label="Pending" tone="orange" />
              <StatusTile icon={<CheckCircle2 />} value={recognition.confirmed} label="Confirmed" tone="green" />
              <StatusTile icon={<CloudUpload />} value={recognition.today_uploads} label="Today" tone="blue" />
              <StatusTile icon={<CalendarDays />} value={recognition.upload_streak_days} label="Streak" tone="purple" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function StatusTile({ icon, value, label, tone }: { icon: React.ReactNode; value: number; label: string; tone: "orange" | "green" | "blue" | "purple" }) {
  const classes = {
    orange: "bg-orange-50 text-orange-500",
    green: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <div className={`rounded-lg border border-slate-100 p-5 ${classes}`}>
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/80">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{label}</div>
    </div>
  );
}
