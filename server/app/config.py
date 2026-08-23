"""应用配置：.env 加载 + 路径解析。"""
import os
from pathlib import Path

from dotenv import load_dotenv

# server/ 目录
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _rel_path(value: str, default: str) -> Path:
    p = Path(value or default)
    return p if p.is_absolute() else (BASE_DIR / p).resolve()


class Settings:
    """集中读取环境变量，提供类型化访问。"""

    # DeepSeek（Anthropic 兼容端点）
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    llm_chat_model: str = os.getenv("LLM_CHAT_MODEL", "deepseek-v4-flash")
    llm_reasoner_model: str = os.getenv("LLM_REASONER_MODEL", "deepseek-v4-flash")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
    llm_max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
    llm_base_delay_seconds: float = float(os.getenv("LLM_BASE_DELAY_SECONDS", "0.5"))

    # JWT
    jwt_secret: str = os.getenv("JWT_SECRET", "change-me-to-a-long-random-secret")
    jwt_expire_days: int = int(os.getenv("JWT_EXPIRE_DAYS", "30"))

    # 数据
    database_path: Path = _rel_path(os.getenv("DATABASE_PATH", ""), "./data/app.db")
    scenarios_seed_path: Path = _rel_path(os.getenv("SCENARIOS_SEED_PATH", ""), "./data/scenarios.json")

    # 邀请码
    invite_code_count: int = int(os.getenv("INVITE_CODE_COUNT", "20"))

    # 开发期认证绕过（1 = 开放 /auth/dev-login，免邀请码直登；生产必须关闭）
    auth_dev_bypass: bool = os.getenv("AUTH_DEV_BYPASS", "0") == "1"

    # 语音（阶段 3）：开发期 edge-tts + faster-whisper，生产切火山引擎
    whisper_model: str = os.getenv("WHISPER_MODEL", "base")


settings = Settings()
