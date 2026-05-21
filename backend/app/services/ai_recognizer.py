import base64
import json
import mimetypes
from datetime import date
from pathlib import Path
from typing import Any

import httpx

from app.config import get_settings


SYSTEM_PROMPT = """你是一个严谨的股票交易截图识别助手。
你的任务是识别同花顺 App 截图类型，并返回严格 JSON。

截图类型只能是：
- holdings: 持仓页
- transactions: 成交页
- assets: 资产页
- other: 其他

阶段 1 只处理 holdings。若不是持仓页，请返回：
{"error": "不是持仓页截图", "screenshot_type": "other"}

若是持仓页，请返回如下 JSON schema：
{
  "screenshot_type": "holdings",
  "snapshot_date": "YYYY-MM-DD",
  "items": [
    {
      "stock_code": "600519",
      "stock_name": "贵州茅台",
      "quantity": 100,
      "cost_price": 1680.5,
      "current_price": 1720.0,
      "market_value": 172000.0,
      "profit_loss": 3950.0,
      "profit_loss_pct": 2.35
    }
  ]
}

规则：
1. 只输出 JSON，不要输出 Markdown、解释或代码块。
2. 数字字段必须是 number，不要使用 string；缺失字段用 null。
3. 盈亏比例 profit_loss_pct 使用百分数数值，例如 2.35 表示 2.35%。
4. 股票代码保留前导零。
5. 对识别置信度低的字段添加同级布尔标记，例如 "current_price_uncertain": true。
6. 无法识别时返回 {"error": "具体原因"}。
"""


def _image_data_url(image_path: str) -> str:
    path = Path(image_path)
    mime_type = mimetypes.guess_type(path.name)[0] or "image/png"
    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def _extract_json(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`").strip()
        if text.lower().startswith("json"):
            text = text[4:].strip()

    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            return {"error": "AI 返回内容不是有效 JSON"}
        try:
            value = json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return {"error": "AI 返回内容不是有效 JSON"}

    if not isinstance(value, dict):
        return {"error": "AI 返回 JSON 顶层不是对象"}
    return value


def recognize_screenshot(image_path: str, hint_type: str | None = None) -> dict[str, Any]:
    """
    Send a screenshot to Qwen vision and return structured JSON.

    hint_type may be "holdings", "transactions", "assets", or None. Stage 1 only
    accepts holdings data, but the prompt still asks the model to classify first.
    """

    settings = get_settings()
    if not settings.qwen_api_key:
        return {"error": "未配置 QWEN_API_KEY，请先复制 .env.example 为 .env 并填写 API Key"}

    prompt = (
        f"请识别这张截图。今天日期是 {date.today().isoformat()}。"
        "如果截图里没有明确日期，snapshot_date 使用今天日期。"
    )
    if hint_type:
        prompt += f" 用户提示截图类型可能是 {hint_type}。"

    payload = {
        "model": settings.qwen_model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": _image_data_url(image_path)}},
                ],
            },
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }

    endpoint = f"{settings.qwen_base_url.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.qwen_api_key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(
        settings.ai_timeout_seconds,
        connect=10,
        read=settings.ai_timeout_seconds,
        write=10,
        pool=10,
    )

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(endpoint, headers=headers, json=payload)
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text[:300].strip()
        message = f"AI 接口请求失败：HTTP {exc.response.status_code}"
        if detail:
            message += f"，{detail}"
        return {"error": message}
    except httpx.TimeoutException:
        return {
            "error": (
                f"AI 识别超过 {settings.ai_timeout_seconds} 秒未返回。"
                "图片已保存，请检查模型名称、API Key、网络或稍后重试。"
            )
        }
    except httpx.RequestError as exc:
        return {"error": f"AI 接口连接失败：{exc}"}
    except json.JSONDecodeError:
        return {"error": "AI 接口返回不是有效 JSON"}

    try:
        content = body["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        return {"error": "AI 接口返回格式异常"}

    if isinstance(content, list):
        content = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(content, str):
        return {"error": "AI 返回内容格式异常"}

    return _extract_json(content)
