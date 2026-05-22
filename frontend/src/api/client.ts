export type HoldingRow = {
  id?: number;
  account_id?: string;
  account_name?: string;
  snapshot_date?: string;
  stock_code: string;
  stock_name: string | null;
  quantity: number | null;
  cost_price: number | null;
  current_price: number | null;
  market_value: number | null;
  profit_loss: number | null;
  profit_loss_pct: number | null;
  screenshot_id?: number;
  [key: string]: unknown;
};

export type RecognizedHoldingData = {
  screenshot_type: string;
  snapshot_date?: string;
  items?: HoldingRow[];
  error?: string;
  recognition_method?: string;
  asset_check_warning?: string;
  asset_check_difference?: number;
  [key: string]: unknown;
};

export type UploadResponse = {
  screenshot_id: number;
  account_id: string;
  account_name: string;
  status: string;
  recognized_data: RecognizedHoldingData;
  error?: string | null;
};

export type DashboardData = {
  summary: {
    total_assets: number;
    market_value: number;
    cash_available: number;
    daily_profit_loss: number;
    holdings_count: number;
    snapshot_date: string | null;
  };
  holdings: HoldingRow[];
  asset_curve: Array<{ date: string; total_assets: number }>;
  recognition: {
    pending: number;
    confirmed: number;
    rejected: number;
    today_uploads: number;
    upload_streak_days: number;
  };
  recent_transactions: Array<Record<string, unknown>>;
};

export type TransactionRow = {
  id: number;
  account_id: string;
  account_name: string;
  trade_time: string;
  stock_code: string;
  stock_name: string | null;
  direction: "buy" | "sell";
  price: number | null;
  quantity: number | null;
  amount: number | null;
  fee: number | null;
  screenshot_id: number;
};

export type AssetsDailyRow = {
  id: number;
  account_id: string;
  account_name: string;
  snapshot_date: string;
  total_assets: number | null;
  market_value: number | null;
  cash_available: number | null;
  daily_profit_loss: number | null;
  total_profit_loss: number | null;
  screenshot_id: number;
};

export type DashboardSummaryData = Omit<DashboardData, "asset_curve" | "recent_transactions"> & {
  summary: DashboardData["summary"] & {
    change_vs_previous?: {
      total_assets: number | null;
      market_value: number | null;
      cash_available: number | null;
      daily_profit_loss: number | null;
    };
  };
  assets_latest: AssetsDailyRow | null;
  asset_curve: AssetsDailyRow[];
  recent_transactions: TransactionRow[];
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    let message = "请求失败";
    try {
      const data = (await response.json()) as { detail?: unknown };
      message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      message = response.statusText;
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export type Account = {
  id: string;
  name: string;
};

export async function uploadScreenshot(file: File, account: Account): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("account_id", account.id);
  form.append("account_name", account.name);
  return request<UploadResponse>("/api/screenshots/upload", {
    method: "POST",
    body: form,
  });
}

export async function confirmScreenshot(screenshotId: number, data: RecognizedHoldingData) {
  return request<{ screenshot_id: number; status: string; inserted_count: number }>(
    `/api/screenshots/${screenshotId}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screenshot_type: "holdings", data }),
    },
  );
}

export async function getLatestHoldings(accountId = "account_1"): Promise<HoldingRow[]> {
  return request<HoldingRow[]>(`/api/holdings/latest?account_id=${encodeURIComponent(accountId)}`);
}

export async function getDashboardData(accountId = "account_1"): Promise<DashboardData> {
  return request<DashboardData>(`/api/analytics/dashboard?account_id=${encodeURIComponent(accountId)}`);
}

export async function getDashboardSummary(accountId = "account_1", days = 30): Promise<DashboardSummaryData> {
  return request<DashboardSummaryData>(`/api/dashboard/summary?account_id=${encodeURIComponent(accountId)}&days=${days}`);
}

export async function getTransactions(params: {
  accountId?: string;
  start?: string;
  end?: string;
  code?: string;
  direction?: "buy" | "sell" | "";
} = {}): Promise<TransactionRow[]> {
  const search = new URLSearchParams();
  search.set("account_id", params.accountId ?? "account_1");
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.code) search.set("code", params.code);
  if (params.direction) search.set("direction", params.direction);
  return request<TransactionRow[]>(`/api/transactions?${search.toString()}`);
}

export async function getAssetsTimeline(accountId = "account_1", days = 30): Promise<AssetsDailyRow[]> {
  return request<AssetsDailyRow[]>(`/api/assets/timeline?account_id=${encodeURIComponent(accountId)}&days=${days}`);
}

export async function getLatestAssets(accountId = "account_1"): Promise<AssetsDailyRow | null> {
  return request<AssetsDailyRow | null>(`/api/assets/latest?account_id=${encodeURIComponent(accountId)}`);
}
