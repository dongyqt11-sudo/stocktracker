import { CalendarDays, CheckCircle2, Image as ImageIcon, Loader2, RefreshCcw, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Account, getAccountScreenshots, ScreenshotRow } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { cn } from "../lib/utils";

type AccountScreenshotsPageProps = {
  refreshKey: number;
  account: Account;
};

const typeLabels: Record<string, string> = {
  holdings: "持仓截图",
  transactions: "成交截图",
  assets: "资产截图",
};

const statusLabels: Record<string, string> = {
  pending: "待确认",
  confirmed: "已入库",
  rejected: "已拒绝",
};

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function screenshotTypeLabel(row: ScreenshotRow) {
  if (row.screenshot_type && typeLabels[row.screenshot_type]) return typeLabels[row.screenshot_type];
  return row.screenshot_type || "未知类型";
}

function statusClass(status: string) {
  if (status === "confirmed") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export default function AccountScreenshotsPage({ account, refreshKey }: AccountScreenshotsPageProps) {
  const [rows, setRows] = useState<ScreenshotRow[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  const loadRows = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getAccountScreenshots(account.id);
      setRows(data.items);
      setSelectedId((current) => {
        if (data.items.some((item) => item.id === current)) return current;
        return data.items[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "账户截图加载失败");
    } finally {
      setIsLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    void loadRows();
  }, [loadRows, refreshKey]);

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>账户截图</CardTitle>
          <Button variant="outline" onClick={() => void loadRows()} disabled={isLoading} className="h-9 px-3">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            刷新
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {error ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm text-amber-800">{error}</div>
          ) : null}

          <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-stripe)] px-3 py-2 text-xs text-text-secondary">
            当前账户：<span className="font-semibold text-text-primary">{account.name}</span>，共 {rows.length} 张截图。
          </div>

          <div className="max-h-[calc(100vh-240px)] space-y-2 overflow-y-auto pr-1">
            {rows.map((row) => {
              const active = selected?.id === row.id;
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-3 text-left transition",
                    active
                      ? "border-primary bg-primary-light/60"
                      : "border-[var(--border-light)] bg-white hover:bg-[var(--bg-hover)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text-primary">{screenshotTypeLabel(row)}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatTime(row.uploaded_at)}
                      </div>
                    </div>
                    <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold", statusClass(row.status))}>
                      {statusLabels[row.status] ?? row.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-text-tertiary">
                    {row.snapshot_date ? <span>快照：{row.snapshot_date}</span> : null}
                    {row.item_count !== null ? <span>识别：{row.item_count} 行</span> : null}
                  </div>
                </button>
              );
            })}

            {!rows.length && !isLoading ? (
              <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-stripe)] px-4 py-12 text-center text-sm text-text-tertiary">
                当前账户还没有截图
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>截图预览</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-text-primary">{screenshotTypeLabel(selected)}</div>
                  <div className="mt-1 text-sm text-text-secondary">{selected.file_name}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", statusClass(selected.status))}>
                    {statusLabels[selected.status] ?? selected.status}
                  </span>
                  {selected.error ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      识别有提示
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已保存原图
                    </span>
                  )}
                </div>
              </div>

              {selected.error ? (
                <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {selected.error}
                </div>
              ) : null}

              <div className="flex min-h-[520px] items-center justify-center overflow-hidden rounded-lg border border-[var(--border-light)] bg-[var(--bg-stripe)]">
                <img
                  src={`${selected.image_url}?account_id=${encodeURIComponent(account.id)}`}
                  alt="账户截图预览"
                  className="max-h-[calc(100vh-260px)] w-full object-contain"
                />
              </div>
            </>
          ) : (
            <div className="flex min-h-[520px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-stripe)] text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
                <ImageIcon className="h-7 w-7" />
              </div>
              <p className="mt-4 text-sm font-semibold text-text-secondary">选择左侧截图后，原图会显示在这里</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
