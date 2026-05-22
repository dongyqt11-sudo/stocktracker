import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Account, AssetsDailyRow, getLatestAssets, getLatestHoldings, HoldingRow } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { formatCurrency, formatNumber, marketTag, profitBadge, signedCurrency } from "../lib/format";
import { cn } from "../lib/utils";

type HoldingsPageProps = {
  refreshKey: number;
  account: Account;
};

export default function HoldingsPage({ refreshKey, account }: HoldingsPageProps) {
  const [rows, setRows] = useState<HoldingRow[]>([]);
  const [assets, setAssets] = useState<AssetsDailyRow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [holdings, latestAssets] = await Promise.all([
        getLatestHoldings(account.id),
        getLatestAssets(account.id).catch(() => null),
      ]);
      setRows(holdings);
      setAssets(latestAssets);
    } catch (err) {
      setError(err instanceof Error ? err.message : "持仓加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  const snapshotDate = rows[0]?.snapshot_date ?? "--";
  const totalMarketValue = useMemo(() => rows.reduce((sum, row) => sum + (row.market_value ?? 0), 0), [rows]);
  const totalProfitLoss = useMemo(() => rows.reduce((sum, row) => sum + (row.profit_loss ?? 0), 0), [rows]);
  const totalQuantity = useMemo(() => rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0), [rows]);

  const plClass = totalProfitLoss > 0 ? "text-up" : totalProfitLoss < 0 ? "text-down" : "text-text-primary";

  return (
    <div className="space-y-5">
      {/* 顶部汇总卡片 */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">快照日期</div>
            <div className="mt-2 text-xl font-bold text-text-primary">{snapshotDate}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">总资产</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(assets?.total_assets)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">持仓市值</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(totalMarketValue)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">可用现金</div>
            <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{formatCurrency(assets?.cash_available)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-text-secondary">浮动盈亏</div>
            <div className={cn("mt-2 text-xl font-bold tabular-nums", plClass)}>{signedCurrency(totalProfitLoss)}</div>
          </CardContent>
        </Card>
      </div>

      {/* 持仓表格 */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>最新持仓 · {account.name}</CardTitle>
          <Button variant="outline" onClick={() => void loadRows()} disabled={isLoading} className="h-9">
            <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            刷新
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="mx-6 mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}
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
                {rows.map((row, i) => {
                  const tag = marketTag(row.stock_code);
                  return (
                    <tr
                      key={`${row.snapshot_date}-${row.stock_code}-${row.id ?? ""}`}
                      className={cn(
                        "transition-colors hover:bg-[var(--bg-hover)]",
                        i % 2 === 1 ? "bg-[var(--bg-stripe)]" : "bg-[var(--bg-card)]",
                      )}
                    >
                      <Td className="font-mono text-sm font-semibold tracking-wide text-text-primary">{row.stock_code}</Td>
                      <Td>
                        <span className="text-text-primary">{row.stock_name ?? "--"}</span>
                        {tag ? (
                          <span className="ml-2 inline-flex rounded bg-[var(--border-light)] px-1.5 py-0.5 text-[11px] font-semibold text-text-tertiary">
                            {tag}
                          </span>
                        ) : null}
                      </Td>
                      <Td className="text-right tabular-nums">{formatNumber(row.quantity)}</Td>
                      <Td className="text-right tabular-nums">{formatCurrency(row.cost_price)}</Td>
                      <Td className="text-right tabular-nums">{formatCurrency(row.current_price)}</Td>
                      <Td className="text-right tabular-nums font-semibold">{formatCurrency(row.market_value)}</Td>
                      <Td className="text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          {profitBadge(row.profit_loss)}
                          <span className={cn("text-xs tabular-nums", row.profit_loss_pct && row.profit_loss_pct > 0 ? "text-up" : row.profit_loss_pct && row.profit_loss_pct < 0 ? "text-down" : "text-text-tertiary")}>
                            {formatNumber(row.profit_loss_pct, "%")}
                          </span>
                        </div>
                      </Td>
                    </tr>
                  );
                })}
                {!rows.length && !isLoading ? (
                  <tr>
                    <Td colSpan={7} className="py-16 text-center text-text-tertiary">
                      暂无持仓数据
                    </Td>
                  </tr>
                ) : null}
              </tbody>
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t-2 border-[var(--border)] bg-[var(--bg-stripe)]">
                    <Td className="text-sm font-bold text-text-primary">合计</Td>
                    <Td>{rows.length} 只</Td>
                    <Td className="text-right tabular-nums font-bold">{formatNumber(totalQuantity)}</Td>
                    <Td />
                    <Td />
                    <Td className="text-right tabular-nums font-bold">{formatCurrency(totalMarketValue)}</Td>
                    <Td className="text-right">{profitBadge(totalProfitLoss)}</Td>
                  </tr>
                </tfoot>
              ) : null}
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
