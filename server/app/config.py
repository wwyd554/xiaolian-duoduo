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
    llm_chat_model: str = os.getenv("LLM_CHAT_MODEL", "deepseek-chat")
    llm_reasoner_model: str = os.getenv("LLM_REASONER_MODEL", "deepseek-reasoner")
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


settings = Settings()
