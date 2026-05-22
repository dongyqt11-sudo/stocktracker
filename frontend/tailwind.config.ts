import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 背景
        "bg-page": "#F7F8FA",
        "bg-card": "#FFFFFF",
        "bg-hover": "#F5F7FA",
        "bg-stripe": "#FAFBFC",

        // 主题色
        primary: "#2563EB",
        "primary-hover": "#1D4ED8",
        "primary-light": "#DBEAFE",

        // A 股涨跌
        up: "#EF4444",
        "up-bg": "#FEF2F2",
        down: "#10B981",
        "down-bg": "#ECFDF5",

        // 文字
        "text-primary": "#1F2937",
        "text-secondary": "#6B7280",
        "text-tertiary": "#9CA3AF",

        // 边框
        border: "#E5E7EB",
        "border-light": "#F3F4F6",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
        soft: "0 8px 30px rgba(15, 23, 42, 0.08)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "'PingFang SC'",
          "'Microsoft YaHei'",
          "sans-serif",
        ],
        mono: ["'SF Mono'", "'Cascadia Code'", "'Consolas'", "monospace"],
      },
      borderRadius: {
        card: "12px",
      },
      spacing: {
        "card": "24px",
        "card-gap": "16px",
      },
    },
  },
  plugins: [],
} satisfies Config;
