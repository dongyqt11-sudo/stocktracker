import { AlertTriangle, CheckCircle2, Flame, RotateCcw, ShieldCheck, Target, XCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, Td, Th } from "../components/ui/table";
import { cn } from "../lib/utils";

type Signal = "on" | "doubt" | "off";
type Regime = "on" | "doubt" | "off";

const signalOptions: Array<{ value: Signal; label: string }> = [
  { value: "on", label: "ON" },
  { value: "doubt", label: "存疑" },
  { value: "off", label: "OFF" },
];

const gateRows: Array<{
  key: string;
  name: string;
  on: string;
  doubt: string;
  off: string;
}> = [
  {
    key: "trend",
    name: "主线龙头趋势",
    on: "持续创新高，站稳 MA20 上方",
    doubt: "高位横盘 / 跌破 MA10",
    off: "集体跌破 MA20、趋势线破坏",
  },
  {
    key: "crowding",
    name: "抱团强度",
    on: "龙头成交占比上升、资金净流入",
    doubt: "量能萎缩、资金犹豫",
    off: "资金从高位龙头持续流出",
  },
  {
    key: "congestion",
    name: "拥挤度信号",
    on: "未触发",
    doubt: "成长 / 大市值高拥挤预警",
    off: "高拥挤 + 已开始兑现",
  },
  {
    key: "styleShift",
    name: "高低切信号",
    on: "无",
    doubt: "高价股开始走弱、低价股零星反弹",
    off: "高价股普跌 + 低价 / 微盘大面积飘红",
  },
  {
    key: "fundamental",
    name: "基本面锚",
    on: "capex 上修、订单能见度延长",
    doubt: "数据平淡、无新增催化",
    off: "capex 指引下修 / 主线逻辑被证伪",
  },
];

const positionRows = [
  ["单票上限", "≤ 20%", "≤ 15%", "≤ 10%"],
  ["单一主线 / 板块上限", "≤ 40%", "≤ 25%", "≤ 15%"],
  ["现金比例", "10-20%", "30-40%", "≥ 60%"],
  ["总持仓上限", "80-90%", "50-60%", "≤ 40%"],
];

const workflow = [
  { title: "盘前", text: "跑范式判定表，定仓位档位；更新主线强度；写下买卖点和止损位。" },
  { title: "盘中", text: "只执行盘前计划，不被跳水情绪和盘中噪音带走，不临时下移止损位。" },
  { title: "盘后", text: "记录范式判定、买入理由、计划止损/止盈、实际执行、是否破纪律和情绪状态。" },
  { title: "每周", text: "统计胜率、盈亏比、最大回撤、破纪律次数；重排标的池相对强度。" },
];

const rules = [
  "只在当前最强的 1-2 条主线里选股。",
  "同一主线只持有相对强度前 30% 的龙头。",
  "禁止低位补涨、超跌反弹、跟风二三线。",
  "高高切前必须确认新方向是真强，不是一根大阳诱多。",
  "范式存疑或 OFF 时，停止新开高高切。",
];

const sellRules = [
  "健康洗盘：主线未坏、个股 MA10 未有效跌破，可按计划持有或回踩加仓。",
  "趋势破坏：跌破 MA10 / MA20 且放量，减仓或止损。",
  "硬止损：买入价回撤 8-10%，无条件执行。",
  "卖飞纪律：价格对 MA10 乖离超过 20-25%，分批兑现，回踩 MA5 / MA10 企稳再接。",
];

const riskRules = [
  "个股级：触发止损，立即执行。",
  "组合级：组合回撤 8-10%，强制降至半仓，停止开新仓。",
  "范式级：判定 OFF，持仓 ≤40%、现金 ≥60%，关闭高高切引擎。",
];

function statusClass(value: Regime) {
  if (value === "on") return "border-red-100 bg-red-50 text-red-700";
  if (value === "off") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  return "border-amber-100 bg-amber-50 text-amber-700";
}

function statusText(value: Regime) {
  if (value === "on") return "范式 ON：进攻";
  if (value === "off") return "范式 OFF：退守";
  return "范式存疑：降档";
}

function statusAdvice(value: Regime) {
  if (value === "on") return "可执行趋势进攻，但单票和板块仓位仍按上限约束。";
  if (value === "off") return "退守到防守仓位，不再讨论高高切，直到范式重新确认。";
  return "仓位压缩，只留最强，停止新开高高切。";
}

function evaluateRegime(signals: Record<string, Signal>): Regime {
  const values = Object.values(signals);
  const offKeys = gateRows.filter((row) => signals[row.key] === "off").map((row) => row.key);
  if (offKeys.includes("styleShift") || offKeys.includes("fundamental")) return "off";
  if (values.filter((value) => value === "on").length >= 4) return "on";
  if (values.filter((value) => value === "doubt").length >= 2 || offKeys.length > 0) return "doubt";
  return "doubt";
}

export default function StrategyPage() {
  const [signals, setSignals] = useState<Record<string, Signal>>(() =>
    Object.fromEntries(gateRows.map((row) => [row.key, "doubt"])) as Record<string, Signal>,
  );

  const regime = useMemo(() => evaluateRegime(signals), [signals]);

  function setSignal(key: string, value: Signal) {
    setSignals((current) => ({ ...current, [key]: value }));
  }

  function resetSignals() {
    setSignals(Object.fromEntries(gateRows.map((row) => [row.key, "doubt"])) as Record<string, Signal>);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="shadow-card">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                  <Flame className="h-3.5 w-3.5" />
                  强者恒强 · 高高切趋势交易系统 v1.0
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight text-text-primary">先判定范式，再谈进攻</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">
                  这套系统只赚资金高度抱团、主线龙头自我强化阶段的趋势钱。范式在，进攻；范式存疑，降档；
                  范式翻转，退守。
                </p>
              </div>
              <div className={cn("min-w-56 rounded-lg border px-4 py-3", statusClass(regime))}>
                <div className="text-xs font-semibold">今日判定</div>
                <div className="mt-1 text-lg font-bold">{statusText(regime)}</div>
                <div className="mt-1 text-xs leading-5">{statusAdvice(regime)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>一句话原则</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-text-secondary">
            <p>系统第一职责不是选股，而是判断范式在不在。</p>
            <p>高高切只在强势标的之间迁移，不能退化成高低切。</p>
            <p>亏钱时认账离场，是系统的一部分。</p>
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>盘前范式闸门</CardTitle>
          <Button variant="outline" onClick={resetSignals} className="h-9">
            <RotateCcw className="h-4 w-4" />
            重置
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-5">
          <Table className="min-w-[980px]">
            <thead>
              <tr>
                <Th>维度</Th>
                <Th>ON</Th>
                <Th>存疑</Th>
                <Th>OFF</Th>
                <Th className="w-56">今日信号</Th>
              </tr>
            </thead>
            <tbody>
              {gateRows.map((row) => (
                <tr key={row.key}>
                  <Td className="font-semibold">{row.name}</Td>
                  <Td className="text-sm text-text-secondary">{row.on}</Td>
                  <Td className="text-sm text-text-secondary">{row.doubt}</Td>
                  <Td className="text-sm text-text-secondary">{row.off}</Td>
                  <Td>
                    <div className="grid grid-cols-3 gap-1.5">
                      {signalOptions.map((option) => {
                        const active = signals[row.key] === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSignal(row.key, option.value)}
                            className={cn(
                              "h-8 rounded-md border text-xs font-semibold transition",
                              active
                                ? option.value === "on"
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : option.value === "off"
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-[var(--border)] bg-white text-text-secondary hover:bg-[var(--bg-hover)]",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>仓位管理</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-5">
            <Table className="min-w-[560px]">
              <thead>
                <tr>
                  <Th>约束</Th>
                  <Th>ON</Th>
                  <Th>存疑</Th>
                  <Th>OFF</Th>
                </tr>
              </thead>
              <tbody>
                {positionRows.map((row) => (
                  <tr key={row[0]}>
                    {row.map((cell, index) => (
                      <Td key={cell} className={cn(index === 0 && "font-semibold", index > 0 && "tabular-nums")}>
                        {cell}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-4 text-sm leading-6 text-text-secondary">
              高高切想集中，风控要求分散：在 2-3 只主线龙头之间集中，但任一单票不破 20%。
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>执行流程</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {workflow.map((item) => (
              <div key={item.title} className="rounded-lg border border-[var(--border-light)] bg-[var(--bg-stripe)] px-4 py-3">
                <div className="text-sm font-semibold text-text-primary">{item.title}</div>
                <div className="mt-1 text-sm leading-6 text-text-secondary">{item.text}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RuleCard icon={Target} title="标的池与买入" items={rules} tone="blue" />
        <RuleCard icon={AlertTriangle} title="卖出与跳水应对" items={sellRules} tone="amber" />
        <RuleCard icon={ShieldCheck} title="风险熔断" items={riskRules} tone="emerald" />
      </section>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>三个必须避开的亏钱场景</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "范式翻转初期：龙头仍在创新高尾声，照常高高切容易接最后一棒。",
            "震荡市 / 无主线：MA5 信号反复假突破，高高切变成高频止损。",
            "主线逻辑证伪：capex 指引下修、订单能见度缩短，趋势线一起破。",
          ].map((item) => (
            <div key={item} className="flex gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              <XCircle className="mt-1 h-4 w-4 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RuleCard({
  icon: Icon,
  items,
  title,
  tone,
}: {
  icon: typeof Target;
  items: string[];
  title: string;
  tone: "blue" | "amber" | "emerald";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  }[tone];

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg border", toneClass)}>
            <Icon className="h-4 w-4" />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-6 text-text-secondary">
            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-primary" />
            <span>{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
