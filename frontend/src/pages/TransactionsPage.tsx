import { Download, RefreshCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Account, getTransactions, TransactionRow } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { formatCurrency, formatNumber } from "../lib/format";
import { cn } from "../lib/utils";

type TransactionsPageProps = {
  refreshKey: number;
  account: Account;
};

const ROW_HEIGHT = 44;
const VISIBLE_BUFFER = 8;

function TradeBadge({ direction }: { direction: "buy" | "sell" }) {
  const isBuy = direction === "buy";
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
        isBuy ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600",
      )}
    >
      {isBuy ? "买入" : "卖出"}
    </span>
  );
}

function exportCSV(rows: TransactionRow[]) {
  const headers = ["时间", "股票代码", "股票名称", "操作", "数量", "价格", "金额", "手续费"];
  const lines = rows.map((row) =>
    [
      row.trade_time,
      row.stock_code,
      row.stock_name ?? "",
      row.direction === "buy" ? "买入" : "卖出",
      row.quantity ?? "",
      row.price ?? "",
      row.amount ?? "",
      row.fee ?? "",
    ].join(","),
  );
  const csv = "﻿" + headers.join(",") + "\n" + lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function TransactionsPage({ refreshKey, account }: TransactionsPageProps) {
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"buy" | "sell" | "">("");
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(
        await getTransactions({
          accountId: account.id,
          start: startDate || undefined,
          end: endDate || undefined,
          code: codeFilter || undefined,
          direction: directionFilter || undefined,
        }),
      );
      setScrollTop(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [account.id, startDate, endDate, codeFilter, directionFilter]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  const containerHeight = Math.max(400, Math.min(720, window.innerHeight - 360));
  const totalHeight = rows.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER);
  const visibleRows = useMemo(() => rows.slice(startIndex, endIndex), [rows, startIndex, endIndex]);
  const offsetY = startIndex * ROW_HEIGHT;

  const summary = useMemo(() => {
    let buyCount = 0;
    let sellCount = 0;
    let buyAmount = 0;
    let sellAmount = 0;
    for (const row of rows) {
      if (row.direction === "buy") {
        buyCount++;
        buyAmount += row.amount ?? 0;
      } else {
        sellCount++;
        sellAmount += row.amount ?? 0;
      }
    }
    return { total: rows.length, buyCount, sellCount, buyAmount, sellAmount };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500">总笔数</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{summary.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500">买入笔数</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-red-500">{summary.buyCount}</div>
            <div className="mt-1 text-xs text-slate-400">{formatCurrency(summary.buyAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500">卖出笔数</div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">{summary.sellCount}</div>
            <div className="mt-1 text-xs text-slate-400">{formatCurrency(summary.sellAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="text-xs font-semibold text-slate-500">净买入</div>
            <div className={cn("mt-2 text-2xl font-bold tabular-nums", summary.buyAmount - summary.sellAmount >= 0 ? "text-red-500" : "text-emerald-600")}>
              {formatCurrency(summary.buyAmount - summary.sellAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>交易流水 - {account.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => void loadRows()} disabled={isLoading}>
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              刷新
            </Button>
            <Button variant="outline" onClick={() => exportCSV(rows)} disabled={!rows.length}>
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">从</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-slate-500">至</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-36 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="股票代码"
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                className="h-9 w-28 text-sm"
                maxLength={6}
              />
            </div>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value as "buy" | "sell" | "")}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
            >
              <option value="">全部操作</option>
              <option value="buy">买入</option>
              <option value="sell">卖出</option>
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div
            ref={containerRef}
            className="overflow-auto rounded-lg border border-slate-100"
            style={{ height: containerHeight }}
            onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
          >
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[152px]" />
                <col className="w-[84px]" />
                <col className="w-[96px]" />
                <col className="w-[72px]" />
                <col className="w-[96px]" />
                <col className="w-[96px]" />
                <col className="w-[112px]" />
                <col className="w-[80px]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">时间</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">代码</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">名称</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500">操作</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">数量</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">价格</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">金额</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold text-slate-500">手续费</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ height: offsetY }} />
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-50 hover:bg-slate-50/60" style={{ height: ROW_HEIGHT }}>
                    <td className="truncate px-3 py-2 text-sm tabular-nums text-slate-600">{row.trade_time.slice(5, 16)}</td>
                    <td className="px-3 py-2 text-sm font-semibold tabular-nums text-slate-800">{row.stock_code}</td>
                    <td className="truncate px-3 py-2 text-sm text-slate-600">{row.stock_name ?? "--"}</td>
                    <td className="px-3 py-2">
                      <TradeBadge direction={row.direction} />
                    </td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{formatNumber(row.quantity)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{formatNumber(row.price)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-700">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-500">{row.fee ? formatNumber(row.fee) : "--"}</td>
                  </tr>
                ))}
                {!rows.length && !isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-sm text-slate-500">
                      暂无交易记录
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
