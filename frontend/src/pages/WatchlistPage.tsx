import { Plus, RefreshCcw, Search, ShieldAlert, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  Account,
  createWatchlistStock,
  deleteWatchlistStock,
  getWatchlist,
  updateWatchlistStock,
  WatchlistStock,
  WatchStatus,
} from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, Td, Th } from "../components/ui/table";
import { formatCurrency, formatNumber, profitClass } from "../lib/format";
import { cn } from "../lib/utils";

type WatchlistPageProps = {
  refreshKey: number;
  account: Account;
};

type SortMode = "sector" | "change_desc" | "change_asc" | "turnover_desc";

const statusOptions: Array<{ value: WatchStatus; label: string }> = [
  { value: "watching", label: "观察中" },
  { value: "focus", label: "重点关注" },
  { value: "archived", label: "已放弃" },
];

function statusLabel(status: string) {
  return statusOptions.find((option) => option.value === status)?.label ?? status;
}

function alertLabel(alert: WatchlistStock["alert"]) {
  if (alert === "target_reached") return "已到目标";
  if (alert === "stop_loss_reached") return "已到止损";
  if (alert === "near_target") return "接近目标";
  if (alert === "near_stop_loss") return "接近止损";
  return null;
}

function formatAmount(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "--";
  if (Math.abs(value) >= 100000000) return `${(value / 100000000).toFixed(2)} 亿`;
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(2)} 万`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
}

function toNumberOrNull(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function WatchlistPage({ refreshKey, account }: WatchlistPageProps) {
  const [rows, setRows] = useState<WatchlistStock[]>([]);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("sector");
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newSector, setNewSector] = useState("未分类");
  const [editSector, setEditSector] = useState("");
  const [editStatus, setEditStatus] = useState<WatchStatus>("watching");
  const [editTarget, setEditTarget] = useState("");
  const [editStopLoss, setEditStopLoss] = useState("");
  const [editNote, setEditNote] = useState("");

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getWatchlist(account.id);
      setRows(data.items);
      setQuoteError(data.quote_error);
      setSelectedId((current) => {
        if (data.items.some((item) => item.id === current)) return current;
        return data.items[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "自选追踪加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  useEffect(() => {
    if (!selected) {
      setEditSector("");
      setEditStatus("watching");
      setEditTarget("");
      setEditStopLoss("");
      setEditNote("");
      return;
    }
    setEditSector(selected.sector);
    setEditStatus(selected.status);
    setEditTarget(selected.target_price === null ? "" : String(selected.target_price));
    setEditStopLoss(selected.stop_loss_price === null ? "" : String(selected.stop_loss_price));
    setEditNote(selected.note);
  }, [selected?.id]);

  const sectors = useMemo(() => Array.from(new Set(rows.map((row) => row.sector))).sort(), [rows]);

  const sectorStats = useMemo(
    () =>
      sectors.map((sector) => {
        const items = rows.filter((row) => row.sector === sector);
        const values = items.map((row) => row.change_pct).filter((value): value is number => value !== null);
        return {
          sector,
          count: items.length,
          up: items.filter((row) => (row.change_pct ?? 0) > 0).length,
          down: items.filter((row) => (row.change_pct ?? 0) < 0).length,
          avg: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
        };
      }),
    [rows, sectors],
  );

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesSector = sectorFilter === "all" || row.sector === sectorFilter;
      const matchesKeyword =
        !keyword ||
        row.stock_code.includes(keyword) ||
        (row.stock_name ?? "").toLowerCase().includes(keyword) ||
        row.sector.toLowerCase().includes(keyword);
      return matchesSector && matchesKeyword;
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === "change_desc") return (b.change_pct ?? -Infinity) - (a.change_pct ?? -Infinity);
      if (sortMode === "change_asc") return (a.change_pct ?? Infinity) - (b.change_pct ?? Infinity);
      if (sortMode === "turnover_desc") return (b.turnover ?? -Infinity) - (a.turnover ?? -Infinity);
      return a.sector.localeCompare(b.sector, "zh-CN") || a.sort_order - b.sort_order || a.stock_code.localeCompare(b.stock_code);
    });
  }, [query, rows, sectorFilter, sortMode]);

  async function addStock() {
    const code = newCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setError("股票代码必须是 6 位数字");
      return;
    }
    setError(null);
    try {
      const created = await createWatchlistStock(account, {
        stock_code: code,
        stock_name: newName.trim() || undefined,
        sector: newSector.trim() || "未分类",
      });
      setNewCode("");
      setNewName("");
      setNewSector("未分类");
      setSelectedId(created.id);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    }
  }

  async function saveSelected() {
    if (!selected) return;
    setError(null);
    try {
      await updateWatchlistStock(selected.id, account.id, {
        sector: editSector.trim() || "未分类",
        status: editStatus,
        target_price: toNumberOrNull(editTarget),
        stop_loss_price: toNumberOrNull(editStopLoss),
        note: editNote,
      });
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function removeStock(row: WatchlistStock) {
    setError(null);
    try {
      await deleteWatchlistStock(row.id, account.id);
      if (selectedId === row.id) setSelectedId(null);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sectorStats.slice(0, 4).map((stat) => (
          <Card key={stat.sector} className="shadow-card">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold text-text-secondary">{stat.sector}</div>
                  <div className="mt-2 text-xl font-bold tabular-nums text-text-primary">{stat.count} 只</div>
                </div>
                <div className={cn("text-right text-lg font-bold tabular-nums", profitClass(stat.avg))}>
                  {formatNumber(stat.avg, "%")}
                </div>
              </div>
              <div className="mt-3 flex gap-3 text-xs text-text-tertiary">
                <span className="text-up">上涨 {stat.up}</span>
                <span className="text-down">下跌 {stat.down}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {!sectorStats.length ? (
          <Card className="shadow-card xl:col-span-4">
            <CardContent className="p-5 text-sm text-text-tertiary">暂无自选股票</CardContent>
          </Card>
        ) : null}
      </section>

      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle>自选追踪 · {account.name}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="代码" className="w-28" />
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="名称" className="w-32" />
            <Input value={newSector} onChange={(event) => setNewSector(event.target.value)} placeholder="板块" className="w-32" />
            <Button onClick={() => void addStock()} className="h-9">
              <Plus className="h-4 w-4" />
              添加
            </Button>
            <Button variant="outline" onClick={() => void loadRows()} disabled={isLoading} className="h-9">
              <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              刷新
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {error ? <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {quoteError ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              <ShieldAlert className="h-4 w-4" />
              行情暂不可用，已显示本地自选信息
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-text-tertiary" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索" className="pl-9" />
            </div>
            <select
              value={sectorFilter}
              onChange={(event) => setSectorFilter(event.target.value)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary"
            >
              <option value="all">全部板块</option>
              {sectors.map((sector) => (
                <option key={sector} value={sector}>
                  {sector}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="h-9 rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary"
            >
              <option value="sector">按板块</option>
              <option value="change_desc">涨幅优先</option>
              <option value="change_asc">跌幅优先</option>
              <option value="turnover_desc">成交额优先</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>代码</Th>
                  <Th>名称</Th>
                  <Th>板块</Th>
                  <Th>状态</Th>
                  <Th className="text-right">最新价</Th>
                  <Th className="text-right">涨跌幅</Th>
                  <Th className="text-right">成交额</Th>
                  <Th className="text-right">换手率</Th>
                  <Th className="text-right">60 日</Th>
                  <Th>提醒</Th>
                  <Th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, i) => {
                  const alert = alertLabel(row.alert);
                  const active = selected?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-[var(--bg-hover)]",
                        active ? "bg-primary-light/60" : i % 2 === 1 ? "bg-[var(--bg-stripe)]" : "bg-[var(--bg-card)]",
                      )}
                    >
                      <Td className="font-mono text-sm font-semibold tracking-wide">{row.stock_code}</Td>
                      <Td>{row.stock_name ?? "--"}</Td>
                      <Td>
                        <span className="inline-flex rounded bg-[var(--border-light)] px-2 py-1 text-xs font-semibold text-text-secondary">
                          {row.sector}
                        </span>
                      </Td>
                      <Td>{statusLabel(row.status)}</Td>
                      <Td className="text-right tabular-nums">{formatCurrency(row.latest_price)}</Td>
                      <Td className={cn("text-right tabular-nums font-semibold", profitClass(row.change_pct))}>
                        {formatNumber(row.change_pct, "%")}
                      </Td>
                      <Td className="text-right tabular-nums">{formatAmount(row.turnover)}</Td>
                      <Td className="text-right tabular-nums">{formatNumber(row.turnover_rate, "%")}</Td>
                      <Td className={cn("text-right tabular-nums", profitClass(row.sixty_day_change_pct))}>
                        {formatNumber(row.sixty_day_change_pct, "%")}
                      </Td>
                      <Td>
                        {alert ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                            <Target className="h-3.5 w-3.5" />
                            {alert}
                          </span>
                        ) : (
                          <span className="text-text-tertiary">--</span>
                        )}
                      </Td>
                      <Td>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeStock(row);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary transition hover:bg-red-50 hover:text-red-600"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </tr>
                  );
                })}
                {!filteredRows.length ? (
                  <tr>
                    <Td colSpan={11} className="py-14 text-center text-text-tertiary">
                      暂无匹配数据
                    </Td>
                  </tr>
                ) : null}
              </tbody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <section className="max-w-xl">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>观察信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 text-xs font-semibold text-text-secondary">板块</div>
                <Input value={editSector} onChange={(event) => setEditSector(event.target.value)} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-text-secondary">状态</div>
                <select
                  value={editStatus}
                  onChange={(event) => setEditStatus(event.target.value as WatchStatus)}
                  className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm text-text-primary outline-none focus:border-primary"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs font-semibold text-text-secondary">目标价</div>
                  <Input value={editTarget} onChange={(event) => setEditTarget(event.target.value)} inputMode="decimal" />
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold text-text-secondary">止损价</div>
                  <Input value={editStopLoss} onChange={(event) => setEditStopLoss(event.target.value)} inputMode="decimal" />
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-text-secondary">备注</div>
                <textarea
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  className="min-h-28 w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </div>
              <Button onClick={() => void saveSelected()} className="w-full">
                保存
              </Button>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
