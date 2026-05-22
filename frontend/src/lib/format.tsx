export function formatNumber(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${suffix}`;
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function profitClass(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) {
    return "text-slate-700";
  }
  return value > 0 ? "text-red-500" : "text-emerald-600";
}

export function signedCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatCurrency(value)}`;
}

export function marketTag(code: string | null | undefined): string | null {
  if (!code || code.length < 3) return null;
  const prefix = code.slice(0, 3);
  if (prefix === "688") return "科创";
  if (prefix === "300" || prefix === "301") return "创业";
  if (code.startsWith("60")) return "沪市";
  if (code.startsWith("00")) return "深市";
  if (code.startsWith("51") || code.startsWith("15") || code.startsWith("58")) return "ETF";
  return null;
}

export function profitBadge(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return <span className="text-text-tertiary">--</span>;
  const isUp = value > 0;
  const isDown = value < 0;
  const sign = isUp ? "+" : "";
  const display = `${sign}${formatCurrency(Math.abs(value))}${suffix}`;
  if (!isUp && !isDown) return <span className="tabular-nums text-text-secondary">{display}</span>;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${
        isUp ? "bg-up-bg text-up" : "bg-down-bg text-down"
      }`}
    >
      {display}
    </span>
  );
}
