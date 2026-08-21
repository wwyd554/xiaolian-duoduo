"""邀请码管理 CLI。

用法（在 server/ 目录下）:
    python -m app.auth.gen_code --count 20       # 生成 20 个新邀请码并入库
    python -m app.auth.gen_code --count 5 --print-only   # 只打印不入库
    python -m app.auth.gen_code --list           # 列出全部邀请码及使用状态
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone

from ..config import settings
from ..database import db, init_db
from .routes import generate_invite_codes


def save_codes(codes: list[str]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with db() as conn:
        conn.executemany(
            "INSERT OR IGNORE INTO invite_codes (code, created_at) VALUES (?, ?)",
            [(c, now) for c in codes],
        )
    print(f"已入库 {len(codes)} 个邀请码")


def main() -> None:
    parser = argparse.ArgumentParser(description="邀请码管理")
    parser.add_argument("--count", type=int, default=settings.invite_code_count, help="生成数量")
    parser.add_argument("--print-only", action="store_true", help="只打印不入库")
    parser.add_argument("--list", action="store_true", help="列出全部邀请码")
    args = parser.parse_args()

    init_db()

    if args.list:
        with db() as conn:
            rows = conn.execute(
                "SELECT code, used_by, used_at, created_at FROM invite_codes ORDER BY created_at DESC"
            ).fetchall()
        if not rows:
            print("（暂无邀请码，先用 --count 生成）")
            return
        print(f"共 {len(rows)} 个邀请码：")
        for r in rows:
            used = f"已用({r['used_by']})" if r["used_by"] else "未用"
            print(f"  {r['code']}  {used}  创建于 {r['created_at']}")
        return

    codes = generate_invite_codes(max(1, args.count))
    if args.print_only:
        print("\n".join(codes))
        return
    save_codes(codes)
    print("\n".join(codes))


if __name__ == "__main__":
    main()
