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
