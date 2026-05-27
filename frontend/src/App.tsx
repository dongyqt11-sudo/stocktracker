import {
  BarChart3,
  BookOpen,
  CloudUpload,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Radar,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Account } from "./api/client";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import AnalyticsPage from "./pages/AnalyticsPage";
import DashboardPage from "./pages/DashboardPage";
import HoldingsPage from "./pages/HoldingsPage";
import NotesPage from "./pages/NotesPage";
import TransactionsPage from "./pages/TransactionsPage";
import UploadPage from "./pages/UploadPage";
import WatchlistPage from "./pages/WatchlistPage";

type Page = "dashboard" | "upload" | "holdings" | "watchlist" | "transactions" | "analytics" | "notes";

const accounts: Account[] = [
  { id: "account_1", name: "账户 1" },
  { id: "account_2", name: "账户 2" },
];

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "仪表盘", icon: LayoutDashboard },
  { id: "upload", label: "上传识别", icon: CloudUpload },
  { id: "holdings", label: "持仓", icon: LineChart },
  { id: "watchlist", label: "自选追踪", icon: Radar },
  { id: "transactions", label: "交易", icon: FileText },
  { id: "analytics", label: "分析", icon: BarChart3 },
  { id: "notes", label: "笔记", icon: BookOpen },
];

const pageTitles: Record<Page, string> = {
  dashboard: "仪表盘",
  upload: "上传识别",
  holdings: "持仓",
  watchlist: "自选追踪",
  transactions: "交易",
  analytics: "分析",
  notes: "笔记",
};

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-card border border-dashed border-[var(--border)] bg-[var(--bg-card)] px-8 py-16 text-center shadow-card">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-primary">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-text-primary">{title}</h2>
      <p className="mt-2 text-sm text-text-secondary">此页面将在后续阶段完成。</p>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeAccountId, setActiveAccountId] = useState(() => localStorage.getItem("stocktracker-account") || "account_1");
  const activeAccount = accounts.find((account) => account.id === activeAccountId) ?? accounts[0];

  function selectAccount(accountId: string) {
    setActiveAccountId(accountId);
    localStorage.setItem("stocktracker-account", accountId);
    setRefreshKey((value) => value + 1);
  }

  const content = useMemo(() => {
    if (page === "dashboard") {
      return <DashboardPage refreshKey={refreshKey} account={activeAccount} onNavigate={(target) => setPage(target)} />;
    }
    if (page === "holdings") {
      return <HoldingsPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "watchlist") {
      return <WatchlistPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "transactions") {
      return <TransactionsPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "analytics") {
      return <AnalyticsPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "notes") {
      return <NotesPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "upload") {
      return (
        <UploadPage
          account={activeAccount}
          onConfirmed={(screenshotType) => {
            setRefreshKey((value) => value + 1);
            setPage(screenshotType === "holdings" ? "holdings" : "dashboard");
          }}
        />
      );
    }
    return <PlaceholderPage title={pageTitles[page]} />;
  }, [activeAccount, page, refreshKey]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg-page)" }}>
      {/* 侧栏 */}
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-6 shadow-card lg:flex">
        {/* Logo */}
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-sm">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight text-text-primary">StockTracker</div>
            <div className="text-xs text-text-tertiary">本地交易日志</div>
          </div>
        </div>

        {/* 账户切换 */}
        <div className="mt-6 rounded-card border border-[var(--border-light)] bg-[var(--bg-stripe)] p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-tertiary">账户</div>
          <div className="grid gap-1.5">
            {accounts.map((account) => {
              const active = activeAccount.id === account.id;
              return (
                <button
                  key={account.id}
                  onClick={() => selectAccount(account.id)}
                  className={cn(
                    "relative h-10 rounded-lg py-2 pl-4 pr-3 text-left text-sm font-semibold transition",
                    active
                      ? "bg-primary-light text-primary"
                      : "bg-[#F3F4F6] text-text-secondary hover:bg-[var(--bg-hover)]",
                  )}
                >
                  {active ? <span className="absolute left-1 top-2 bottom-2 w-[3px] rounded-full bg-primary" /> : null}
                  {account.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="mt-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                className={cn(
                  "flex h-11 w-full items-center gap-3 rounded-lg px-4 text-sm font-semibold transition",
                  active
                    ? "bg-primary-light text-primary"
                    : "text-text-secondary hover:bg-[var(--bg-hover)] hover:text-text-primary",
                )}
                onClick={() => setPage(item.id)}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 底部 */}
        <div className="mt-auto">
          <div className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-stripe)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <ShieldCheck className="h-4 w-4 text-down" />
              本地存储 · 隐私优先
            </div>
          </div>
          <div className="mt-8 flex items-center justify-between px-3 text-text-tertiary">
            <Settings className="h-4 w-4" />
            <span className="h-4 w-px bg-[var(--border-light)]" />
            <LogOut className="h-4 w-4" />
          </div>
        </div>
      </aside>

      {/* 主区域 */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">{pageTitles[page]}</h1>
              <p className="mt-0.5 text-sm text-text-secondary">当前账户：{activeAccount.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={activeAccount.id}
                onChange={(event) => selectAccount(event.target.value)}
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-text-primary outline-none focus:border-primary"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => setPage("upload")} className="h-10 rounded-lg px-4">
                <CloudUpload className="h-4 w-4" />
                上传截图
              </Button>
            </div>
          </div>
        </header>

        <main className="px-6 pb-10 lg:px-8">{content}</main>
      </div>
    </div>
  );
}
