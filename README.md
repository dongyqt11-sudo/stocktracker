# StockTracker

本地运行的个人股票交易记录助手。阶段 1 MVP 已实现主链路：

上传或粘贴同花顺持仓页截图，使用本地 Windows OCR 识别，确认修正后写入本地 SQLite，并在持仓页查看最新持仓。

## 环境要求

- Python 3.11+
- uv
- Node.js 18+
- pnpm
- make

如果本机还没有 `uv` 或 `pnpm`：

```powershell
python -m pip install uv
npm install -g pnpm
```

## 首次配置

后端配置：

```powershell
cd backend
Copy-Item .env.example .env
```

编辑 `backend/.env`：

```env
DATABASE_URL=sqlite:///./data/stocktracker.db
SCREENSHOT_DIR=./data/screenshots
FRONTEND_ORIGIN=http://127.0.0.1:5173
```

安装依赖：

```powershell
cd backend
python -m uv sync

cd ..\frontend
pnpm install
```

## 启动

在项目根目录运行：

```powershell
make dev
```

如果 Windows 还没有安装 `make`，可以先用备用脚本：

```powershell
.\dev.ps1
```

访问：

- 前端：http://127.0.0.1:5173
- 后端接口文档：http://127.0.0.1:8000/docs

也可以分别启动：

```powershell
make backend
make frontend
```

## 阶段 1 功能

- 截图上传 API：`POST /api/screenshots/upload`
- 截图确认入库：`POST /api/screenshots/{id}/confirm`
- 最新持仓：`GET /api/holdings/latest`
- 个股持仓历史：`GET /api/holdings/history?code=600519`
- 上传页支持拖拽、选择图片、`Ctrl+V` 粘贴图片
- 识别结果可编辑，不确定字段黄色高亮
- 股票代码必须是 6 位数字；上传后会从历史持仓和本地映射表建议代码，确认入库后会继续维护本地“股票名称-代码”映射
- 持仓页按 A 股习惯显示红涨绿跌

## 阶段 2 进展

- OCR 已支持自动判断持仓页、成交页、资产页。
- 成交页会返回逐笔交易 JSON，并可确认写入 `transactions`。
- 资产页会返回资产快照 JSON，并在总资产与“持仓市值 + 可用现金”差额超过 1 元时给出提示；确认后写入 `assets_daily`。
- 新增交易查询、资产曲线、最新资产、Dashboard 汇总接口。
- Dashboard 首页已接入资产、持仓、交易和识别状态数据，支持资产曲线近 7 日、近 30 日、近 90 日和自定义天数切换。

阶段 2 API：

- 交易流水：`GET /api/transactions?account_id=&start=&end=&code=&direction=`
- 资产曲线：`GET /api/assets/timeline?account_id=&days=30`
- 最新资产：`GET /api/assets/latest?account_id=`
- Dashboard 汇总：`GET /api/dashboard/summary?account_id=&days=30`
- 数据一致性校验：`GET /api/dashboard/consistency?account_id=`
- 笔记：`GET/POST /api/notes?account_id=`，编辑和删除会校验当前账户

阶段 2 页面：

- Dashboard：资产指标卡、资产曲线、持仓概览、最近交易、识别状态、一致性警告
- 数据一致性：已有成交记录时对比成交净变动；没有成交记录时自动用前后持仓快照差值推算买入/卖出变化
- 交易流水：筛选、CSV 导出、虚拟滚动
- 资产分析：大图资产曲线，三线叠加、hover 数值
- 上传页：支持持仓/成交/资产三种截图 OCR 识别与入库
- 笔记页：按账户隔离，支持列表、筛选、新建、编辑和删除

## 清理测试数据

如果早期测试产生了占位股票代码（例如 `11111`、`2222`），可以运行：

```powershell
python scripts/clean_test_data.py
```

脚本会删除所有股票代码不是 6 位数字的持仓记录，并同步清理这些记录关联的截图和交易流水。

## 数据备份

所有数据都在本地：

- 数据库：`backend/data/stocktracker.db`
- 原始截图：`backend/data/screenshots/`
- 股票代码映射：`backend/data/stock_code_map.json`
- 笔记、成交、资产、持仓都按当前账户分开保存

备份时复制整个 `backend/data/` 目录即可。恢复时关闭服务，把备份目录覆盖回 `backend/data/`。

## 注意

- 阶段 1 只支持“持仓页”识别与入库。
- 当前识别链路不调用 AI，使用 Windows 本地 OCR；如果截图中没有显示股票代码，代码会留空并标黄，确认入库前需要手动填写。填过一次后，同名股票会从本地映射表自动补代码。
- MVP 暂不使用迁移工具，服务启动时会自动创建 SQLite 表。
