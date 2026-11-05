"""应用配置：.env 加载 + 路径解析。"""
import os
import math
from pathlib import Path
from urllib.parse import urlsplit

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
    # 模型名不写死在代码里，一律由 .env 指定（开发/生产各自配置）。
    # 留空时 llm.py 会报错提示配置，避免误用默认型号。
    llm_chat_model: str = os.getenv("LLM_CHAT_MODEL", "")
    llm_reasoner_model: str = os.getenv("LLM_REASONER_MODEL", "")
    llm_max_tokens: int = int(os.getenv("LLM_MAX_TOKENS", "4096"))
    llm_timeout_seconds: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "120"))
    llm_max_retries: int = int(os.getenv("LLM_MAX_RETRIES", "3"))
    llm_base_delay_seconds: float = float(os.getenv("LLM_BASE_DELAY_SECONDS", "0.5"))
    llm_realtime_thinking: str = os.getenv("LLM_REALTIME_THINKING", "disabled")
    llm_review_thinking: str = os.getenv("LLM_REVIEW_THINKING", "disabled")

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

    environment: str = os.getenv("APP_ENV", "development")
    cors_origins: list[str] = [s.strip() for s in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost"
    ).split(",") if s.strip()]
    job_worker_enabled: bool = os.getenv("JOB_WORKER_ENABLED", "1") == "1"
    job_poll_seconds: float = float(os.getenv("JOB_POLL_SECONDS", "1"))
    job_lease_seconds: float = float(os.getenv("JOB_LEASE_SECONDS", "30"))
    job_timeout_seconds: float = float(os.getenv("JOB_TIMEOUT_SECONDS", "900"))
    job_max_attempts: int = int(os.getenv("JOB_MAX_ATTEMPTS", "3"))
    trace_dir: Path = _rel_path(os.getenv("TRACE_DIR", ""), "./.trajectories")
    trace_retention_days: int = int(os.getenv("TRACE_RETENTION_DAYS", "14"))
    harness_runtime_enabled: bool = os.getenv("HARNESS_RUNTIME_ENABLED", "1") == "1"
    context_input_budget: int = int(os.getenv("CONTEXT_INPUT_BUDGET", "16000"))
    max_message_chars: int = int(os.getenv("MAX_MESSAGE_CHARS", "4000"))
    harness_tools_enabled: bool = os.getenv("HARNESS_TOOLS_ENABLED", "1") == "1"
    harness_native_tools_enabled: bool = os.getenv("HARNESS_NATIVE_TOOLS_ENABLED", "1") == "1"
    runtime_model_attempts: int = int(os.getenv("RUNTIME_MODEL_ATTEMPTS", "12"))
    runtime_reserved_tokens: int = int(os.getenv("RUNTIME_RESERVED_TOKENS", "120000"))
    speech_requests_per_minute: int = int(os.getenv("SPEECH_REQUESTS_PER_MINUTE", "30"))
    speech_concurrency: int = int(os.getenv("SPEECH_CONCURRENCY", "4"))

    def validate(self) -> None:
        if self.llm_realtime_thinking not in {"disabled", "enabled", "inherit"}:
            raise ValueError("LLM_REALTIME_THINKING 必须为 disabled、enabled 或 inherit")
        if self.llm_review_thinking not in {"disabled", "enabled", "inherit"}:
            raise ValueError("LLM_REVIEW_THINKING 必须为 disabled、enabled 或 inherit")
        if not 3 <= self.runtime_model_attempts <= 30 or not 8000 <= self.runtime_reserved_tokens <= 500000:
            raise ValueError("Runtime 调用预算配置无效")
        if not 1 <= self.speech_requests_per_minute <= 120 or not 1 <= self.speech_concurrency <= 16:
            raise ValueError("语音限流配置无效")
        if not 8000 <= self.context_input_budget <= 64000 or not 1 <= self.max_message_chars <= 8000:
            raise ValueError("上下文预算或单条消息长度配置无效")
        numeric_limits = (self.job_poll_seconds, self.job_lease_seconds, self.job_timeout_seconds,
                          self.llm_timeout_seconds, self.llm_base_delay_seconds)
        if any(not math.isfinite(value) for value in numeric_limits):
            raise ValueError("时间配置必须为有限数值")
        if self.llm_timeout_seconds <= 0 or self.llm_base_delay_seconds < 0 or self.llm_max_tokens < 1:
            raise ValueError("模型超时、退避或 Token 上限无效")
        if self.environment not in {"development", "test", "production"}:
            raise ValueError("APP_ENV 必须是 development、test 或 production")
        if self.job_lease_seconds < 3 or self.job_timeout_seconds < self.job_lease_seconds:
            raise ValueError("任务租约至少 3 秒，任务时限必须不短于租约")
        if self.job_poll_seconds <= 0 or not 1 <= self.job_max_attempts <= 10:
            raise ValueError("任务轮询间隔或重试次数无效")
        if self.trace_retention_days < 1 or self.llm_max_retries < 1:
            raise ValueError("轨迹保存期限和模型调用次数必须为正数")
        if self.environment == "production":
            if len(self.jwt_secret) < 32 or self.jwt_secret.startswith("change-me"):
                raise ValueError("生产环境必须设置至少 32 字符的随机 JWT_SECRET")
            if self.auth_dev_bypass:
                raise ValueError("生产环境禁止 AUTH_DEV_BYPASS")
            if not self.cors_origins or any(
                not _valid_production_origin(origin) for origin in self.cors_origins
            ):
                raise ValueError("生产 CORS_ORIGINS 必须为明确的 HTTPS 来源")
            if (not self.deepseek_api_key.strip() or self.deepseek_api_key in {"sk-xxxx", "your-api-key"}
                    or not self.llm_chat_model.strip() or not self.llm_reasoner_model.strip()):
                raise ValueError("生产环境必须配置模型凭证及对话、复盘模型")


def _valid_production_origin(origin: str) -> bool:
    try:
        parsed = urlsplit(origin)
        _ = parsed.port
        return (parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username
                and not parsed.password and not parsed.path and not parsed.query and not parsed.fragment
                and "*" not in origin and not any(c.isspace() for c in origin))
    except ValueError:
        return False


settings = Settings()
