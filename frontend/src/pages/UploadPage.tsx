import { ClipboardPaste, FileCheck2, Loader2, Plus, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Account, confirmScreenshot, HoldingRow, RecognizedHoldingData, uploadScreenshot } from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Table, Td, Th } from "../components/ui/table";
import { cn } from "../lib/utils";

type UploadPageProps = {
  account: Account;
  onConfirmed: () => void;
};

const columns: Array<{ key: keyof HoldingRow; label: string; numeric?: boolean }> = [
  { key: "stock_code", label: "代码" },
  { key: "stock_name", label: "名称" },
  { key: "quantity", label: "数量", numeric: true },
  { key: "cost_price", label: "成本价", numeric: true },
  { key: "current_price", label: "现价", numeric: true },
  { key: "market_value", label: "市值", numeric: true },
  { key: "profit_loss", label: "盈亏", numeric: true },
  { key: "profit_loss_pct", label: "盈亏%", numeric: true },
];

const emptyRow: HoldingRow = {
  stock_code: "",
  stock_name: "",
  quantity: null,
  cost_price: null,
  current_price: null,
  market_value: null,
  profit_loss: null,
  profit_loss_pct: null,
};

export default function UploadPage({ account, onConfirmed }: UploadPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotId, setScreenshotId] = useState<number | null>(null);
  const [recognizedData, setRecognizedData] = useState<RecognizedHoldingData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canConfirm = useMemo(() => {
    return Boolean(
      screenshotId &&
        recognizedData &&
        recognizedData.screenshot_type === "holdings" &&
        recognizedData.items?.length,
    );
  }, [recognizedData, screenshotId]);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setIsUploading(true);
    setUploadStatus("图片已接收，正在使用本地 OCR 识别...");
    setScreenshotId(null);
    setRecognizedData(null);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const response = await uploadScreenshot(file, account);
      setScreenshotId(response.screenshot_id);
      setRecognizedData(response.recognized_data);
      setUploadStatus(response.error || response.recognized_data.error ? "图片已保存，OCR 未能完整解析" : "识别完成，请检查后确认入库");
      if (response.error || response.recognized_data.error) {
        setError(response.error || response.recognized_data.error || "识别失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
      setUploadStatus("上传失败");
    } finally {
      setIsUploading(false);
    }
  }, [account]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((entry) => entry.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        event.preventDefault();
        void processFile(file);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processFile]);

  function updateSnapshotDate(value: string) {
    setRecognizedData((current) => (current ? { ...current, snapshot_date: value } : current));
  }

  function updateCell(rowIndex: number, key: keyof HoldingRow, value: string, numeric?: boolean) {
    setRecognizedData((current) => {
      if (!current) return current;
      const items = current.items.map((row, index) => {
        if (index !== rowIndex) return row;
        return { ...row, [key]: numeric ? (value === "" ? null : Number(value)) : value };
      });
      return { ...current, items };
    });
  }

  function addRow() {
    setRecognizedData((current) => {
      if (!current) {
        return {
          screenshot_type: "holdings",
          snapshot_date: new Date().toISOString().slice(0, 10),
          items: [{ ...emptyRow }],
        };
      }
      return { ...current, items: [...current.items, { ...emptyRow }] };
    });
  }

  function removeRow(rowIndex: number) {
    setRecognizedData((current) => {
      if (!current) return current;
      return { ...current, items: current.items.filter((_, index) => index !== rowIndex) };
    });
  }

  async function handleConfirm() {
    if (!screenshotId || !recognizedData) return;
    const missingCode = recognizedData.items.some((item) => !String(item.stock_code ?? "").trim());
    if (missingCode) {
      setError("截图里没有股票代码，请先在黄色代码栏手动补齐，再确认入库。");
      return;
    }
    setError(null);
    setIsConfirming(true);
    try {
      await confirmScreenshot(screenshotId, recognizedData);
      onConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "确认入库失败");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.28fr]">
      <Card>
        <CardHeader>
          <CardTitle>上传截图</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div
            className={cn(
              "flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center transition",
              isDragging && "border-blue-500 bg-blue-50",
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const file = event.dataTransfer.files.item(0);
              if (file) void processFile(file);
            }}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="截图预览" className="max-h-[340px] rounded-lg object-contain shadow-soft" />
            ) : (
              <>
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <p className="text-lg font-semibold text-slate-950">拖入同花顺持仓截图</p>
                <p className="mt-2 text-sm text-slate-500">也可以点击选择图片，或直接 Ctrl+V 粘贴截图</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-11">
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              选择图片
            </Button>
            <Button variant="outline" disabled className="h-11">
              <ClipboardPaste className="h-4 w-4" />
              Ctrl+V 粘贴
            </Button>
            <input
              ref={fileInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.item(0);
                if (file) void processFile(file);
              }}
            />
          </div>

          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              本地识别 · 隐私优先
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-700/80">当前使用 Windows 本地 OCR，不调用 AI，不上传到外部服务。</p>
          </div>

          {uploadStatus ? <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">{uploadStatus}</div> : null}
          {isUploading ? <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">本地 OCR 通常几秒完成。截图里没有显示股票代码时，代码栏会留空并标黄。</div> : null}
          {error ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>识别结果</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addRow}>
              <Plus className="h-4 w-4" />
              新增
            </Button>
            <Button onClick={handleConfirm} disabled={!canConfirm || isConfirming}>
              {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              确认入库
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {recognizedData ? (
            <>
              <div className="grid gap-3 sm:grid-cols-[120px_220px_1fr] sm:items-center">
                <label className="text-sm font-semibold text-slate-600" htmlFor="snapshot-date">
                  快照日期
                </label>
                <Input id="snapshot-date" type="date" value={recognizedData.snapshot_date ?? ""} onChange={(event) => updateSnapshotDate(event.target.value)} />
                <div className="text-xs text-slate-400">黄色字段代表 OCR 不确定，需要你确认或补充。</div>
              </div>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <thead className="bg-slate-50">
                    <tr>
                      {columns.map((column) => (
                        <Th key={String(column.key)}>{column.label}</Th>
                      ))}
                      <Th className="w-16">操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {recognizedData.items.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {columns.map((column) => {
                          const uncertain = Boolean(row[`${String(column.key)}_uncertain`]);
                          return (
                            <Td key={String(column.key)} className={uncertain ? "bg-amber-50" : undefined}>
                              <Input
                                type={column.numeric ? "number" : "text"}
                                step={column.numeric ? "0.001" : undefined}
                                value={(row[column.key] ?? "") as string | number}
                                onChange={(event) => updateCell(rowIndex, column.key, event.target.value, column.numeric)}
                                className="min-w-24 border-transparent bg-transparent px-1 focus:border-blue-200 focus:bg-white"
                              />
                            </Td>
                          );
                        })}
                        <Td>
                          <Button variant="ghost" className="h-8 w-8 px-0 text-slate-400" onClick={() => removeRow(rowIndex)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm text-slate-500">
              上传持仓截图后，识别结果会显示在这里。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
