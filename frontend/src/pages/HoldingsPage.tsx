import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Account, AssetsDailyRow, getLatestAssets, getLatestHoldings, HoldingRow } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { formatCurrency, formatNumber, profitClass, signedCurrency } from "../lib/format";

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

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500">快照日期</div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{snapshotDate}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500">总资产</div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{formatCurrency(assets?.total_assets)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500">持仓市值</div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{formatCurrency(totalMarketValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500">可用现金</div>
            <div className="mt-3 text-2xl font-bold text-slate-950">{formatCurrency(assets?.cash_available)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-semibold text-slate-500">浮动盈亏</div>
            <div className={`mt-3 text-2xl font-bold ${profitClass(totalProfitLoss)}`}>{signedCurrency(totalProfitLoss)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>最新持仓 - {account.name}</CardTitle>
          <Button variant="outline" onClick={() => void loadRows()} disabled={isLoading}>
            <RefreshCcw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            刷新
          </Button>
        </CardHeader>
        <CardContent>
          {error ? <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>代码</Th>
                  <Th>名称</Th>
                  <Th className="text-right">数量</Th>
                  <Th className="text-right">成本价</Th>
                  <Th className="text-right">现价</Th>
                  <Th className="text-right">市值</Th>
                  <Th className="text-right">盈亏</Th>
                  <Th className="text-right">盈亏%</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.snapshot_date}-${row.stock_code}-${row.id ?? ""}`}>
                    <Td className="font-semibold text-slate-800">{row.stock_code}</Td>
                    <Td>{row.stock_name}</Td>
                    <Td className="text-right">{formatNumber(row.quantity)}</Td>
                    <Td className="text-right">{formatNumber(row.cost_price)}</Td>
                    <Td className="text-right">{formatNumber(row.current_price)}</Td>
                    <Td className="text-right">{formatCurrency(row.market_value)}</Td>
                    <Td className={`text-right font-semibold ${profitClass(row.profit_loss)}`}>{signedCurrency(row.profit_loss)}</Td>
                    <Td className={`text-right font-semibold ${profitClass(row.profit_loss_pct)}`}>{formatNumber(row.profit_loss_pct, "%")}</Td>
                  </tr>
                ))}
                {!rows.length && !isLoading ? (
                  <tr>
                    <Td colSpan={8} className="py-12 text-center text-slate-500">
                      暂无持仓数据
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
