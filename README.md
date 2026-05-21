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
- 持仓页按 A 股习惯显示红涨绿跌

## 数据备份

所有数据都在本地：

- 数据库：`backend/data/stocktracker.db`
- 原始截图：`backend/data/screenshots/`

备份时复制整个 `backend/data/` 目录即可。恢复时关闭服务，把备份目录覆盖回 `backend/data/`。

## 注意

- 阶段 1 只支持“持仓页”识别与入库。
- 当前识别链路不调用 AI，使用 Windows 本地 OCR；如果截图中没有显示股票代码，代码会留空并标黄，确认入库前需要手动填写。
- MVP 暂不使用迁移工具，服务启动时会自动创建 SQLite 表。
