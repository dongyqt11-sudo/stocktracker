import {
  BarChart3,
  BookOpen,
  CloudUpload,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Settings,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Account } from "./api/client";
import { Button } from "./components/ui/button";
import { cn } from "./lib/utils";
import DashboardPage from "./pages/DashboardPage";
import HoldingsPage from "./pages/HoldingsPage";
import UploadPage from "./pages/UploadPage";

type Page = "dashboard" | "upload" | "holdings" | "transactions" | "analytics" | "notes";

const accounts: Account[] = [
  { id: "account_1", name: "Account 1" },
  { id: "account_2", name: "Account 2" },
];

const navItems: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "upload", label: "Upload OCR", icon: CloudUpload },
  { id: "holdings", label: "Holdings", icon: LineChart },
  { id: "transactions", label: "Trades", icon: FileText },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "notes", label: "Notes", icon: BookOpen },
];

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard",
  upload: "Upload OCR",
  holdings: "Holdings",
  transactions: "Trades",
  analytics: "Analytics",
  notes: "Notes",
};

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-8 py-16 text-center shadow-soft">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        <ShieldCheck className="h-7 w-7" />
      </div>
      <h2 className="mt-5 text-xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">This page will be completed in the next phase.</p>
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
      return <DashboardPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "holdings") {
      return <HoldingsPage refreshKey={refreshKey} account={activeAccount} />;
    }
    if (page === "upload") {
      return (
        <UploadPage
          account={activeAccount}
          onConfirmed={() => {
            setRefreshKey((value) => value + 1);
            setPage("holdings");
          }}
        />
      );
    }
    return <PlaceholderPage title={pageTitles[page]} />;
  }, [activeAccount, page, refreshKey]);

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="hidden w-64 shrink-0 border-r border-slate-100 bg-white/95 px-4 py-8 shadow-[8px_0_30px_rgba(15,23,42,0.04)] lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight text-slate-950">StockTracker</div>
            <div className="text-xs text-slate-500">Local trading journal</div>
          </div>
        </div>

        <div className="mt-7 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Account</div>
          <div className="grid gap-2">
            {accounts.map((account) => (
              <button
                key={account.id}
                onClick={() => selectAccount(account.id)}
                className={cn(
                  "h-10 rounded-md px-3 text-left text-sm font-semibold transition",
                  activeAccount.id === account.id ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 hover:text-blue-700",
                )}
              >
                {account.name}
              </button>
            ))}
          </div>
        </div>

        <nav className="mt-7 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = page === item.id;
            return (
              <button
                key={item.id}
                className={cn(
                  "flex h-12 w-full items-center gap-4 rounded-lg px-5 text-sm font-semibold transition",
                  active ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                )}
                onClick={() => setPage(item.id)}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto">
          <div className="rounded-lg border border-slate-100 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="flex items-center gap-3 text-sm font-semibold text-emerald-700">
              <ShieldCheck className="h-6 w-6" />
              Local data only
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-500">Records are stored locally and separated by account.</p>
          </div>
          <div className="mt-10 flex items-center justify-between px-4 text-slate-400">
            <Settings className="h-5 w-5" />
            <span className="h-5 w-px bg-slate-200" />
            <LogOut className="h-5 w-5" />
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 border-b border-white/70 bg-white/80 backdrop-blur lg:border-b-0">
          <div className="flex items-center justify-between gap-4 px-5 py-5 lg:px-10">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">{pageTitles[page]}</h1>
              <p className="mt-1 text-sm text-slate-500">Current account: {activeAccount.name}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={activeAccount.id}
                onChange={(event) => selectAccount(event.target.value)}
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <Button onClick={() => setPage("upload")} className="h-11 rounded-lg px-5">
                <CloudUpload className="h-4 w-4" />
                Upload
              </Button>
            </div>
          </div>
        </header>

        <main className="px-5 pb-10 lg:px-10">{content}</main>
      </div>
    </div>
  );
}
